/*
 * grunt-sqlscript-process
 * https://github.com/mgierw/grunt-sqlscript-process
 *
 * Copyright (c) 2015 mgierw
 * Licensed under the MIT license.
 */

 'use strict';

module.exports = function(grunt) {
	grunt.registerMultiTask('sqlscript_process', 'Processing sql scripts from specified folder', function() {
		var done = this.async();
		var config = this.data;
		var requirementsMet = true;
		var path = require('path');
		var async = require('async');
		['scripts', 'dialect', 'scriptFilenameTable'].forEach(function(prop) {
			if (!config[prop]) {
				grunt.log.warn('Property \'' + prop + '\' is not defined.');
				requirementsMet = false;
			}
		});
		if (!requirementsMet) {
			return false;
		}
		var scripts = grunt.file.expand(config.scripts);
		if (scripts.length === 0) {
			grunt.log.writeln('No scritps found for mask \'' + config.scripts + '\'');
			return true;
		}
		scripts.sort();

		var processScripts = function(runScriptFunction, runQueryFunction) {
			async.mapSeries(scripts, function(script, doneCallback) {
				grunt.log.write('Processing script \'' + script + '\'...');
				var checkExecutedSql = "select count(*) from " + config.scriptFilenameTable + " where script_name = '" + path.basename(script) + "'";
				console.log(checkExecutedSql);
				runQueryFunction(checkExecutedSql, function(result) {
					if (result[0] == 0) {
						var scriptContent = grunt.file.read(script);
						runScriptFunction(scriptContent, function() {
							grunt.log.writeln(' DONE');
							checkExecutedSql = "insert into " + config.scriptFilenameTable + "(script_name) values('" + path.basename(script) + "')";
							console.log(checkExecutedSql);
							runQueryFunction(checkExecutedSql, function(result) {
								doneCallback(null, script);
							});
						});
					} else {
						grunt.log.writeln(' already executed');
						doneCallback(null, script);
					}
				});
			}, function() {
				grunt.log.writeln('All scripts processed.');
				done();
			});
		};

		// Sqlite-specific processing
		if (config.dialect === 'sqlite') {
			if (!config.sqliteDbFile) {
				grunt.log.warn('Property \'sqliteDbFile\' is not defined.');
				return false;
			}
			var sqlite = require('sqlite3');

			grunt.file.mkdir(path.dirname(config.sqliteDbFile));
			var db = new sqlite.Database(config.sqliteDbFile, function() {
				var runScriptFunction = function(sql, successCallback) {
					db.exec(sql, successCallback);
				};
				var runQueryFunction = function(sql, successCallback) {
					db.run(sql, successCallback);
				};
				var scriptFilenameTableExists = false;
				// TODO: Check if config.scriptFilenameTable exists in database
				if (!scriptFilenameTableExists) {
					runQueryFunction("create table " + config.scriptFilenameTable + "(script_name varchar(100) not null)", function() {
						processScripts(runScriptFunction, runQueryFunction);
					});
				} else {
					processScripts(runScriptFunction, runQueryFunction);
				}
			});
		} else if (['mysql', 'postgresql'].indexOf(config.dialect) !== -1) {
			grunt.log.warn('Specified dialect \'' + config.dialect + '\' not supported yet');
			return false;
		} else {
			grunt.log.warn('Unknown dialect \'' + config.dialect + '\'');
			return false;
		}
	});
};
