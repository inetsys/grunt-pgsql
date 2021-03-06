/*
 * grunt-pgsql
 * https://github.com/llafuente/grunt-pgsql
 *
 * Copyright (c) 2014 Luis Lafuente
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {
    function wrap_pwd(cmd, options) {
        return "(PGPASSWORD='" + options.db.password.replace("'", "\'") + "' " + cmd + ")";
    }

    function to_csv(sql) {
        return "COPY (" + sql + ") TO STDOUT WITH CSV HEADER;";
    }

    function pgdump_args(options) {
        return [
            "-U", options.db.user,
            "-h", options.db.host,
            options.db.name
        ];
    }

    function psql_args(options) {
        return [
          "-U", options.db.user,
          "-h", options.db.host,
          "-d", options.db.name
        ];
    }

    function exec_sql(sql, options, callback) {
        var cmd = wrap_pwd('psql ' + ["-c", "'" + sql + "'"].concat(psql_args(options)).join(" "), options);

        exec(cmd, callback);
    }

    function exec(cmd, callback) {
        console.error("running: " + cmd.info);

        require('child_process').exec(cmd, function(error, stdout, stderr) {
            if (error) {
                console.error(error);
            }

            if (stdout && stdout.length) {
                grunt.verbose.write(stdout);
            }

            if (stderr && stderr.length) {
                console.error(error);
            }

            callback(error, stdout, stderr);
        });
    }

    function get_options(task_name, target) {
        var default_options = {
            db: {
                host: "127.0.0.1",
                name: "database",
                user: "user",
                password: "password",
                charset: "UTF8"
            }
        };

        var target_options = grunt.config([task_name, target, 'options']) || {};
        var task_options = grunt.config([task_name, 'options']) || {};

        return grunt.util._.merge({}, default_options, task_options, target_options);
    }

    function run_all(task, args) {
        Object.keys(grunt.config.data[task]).forEach(function(v, k) {
            if (v !== "all" && v !== "options") {
                grunt.task.run([task, v].concat(args).join(":"));
            }
        });
    }

    grunt.registerMultiTask(
        'pgsql-dump',
        'Dump database to a file (tar.gz)',
        function(file) {
            var options = get_options('pgsql-dump', this.target),
                done = this.async(),
                cmd;

            if (this.target === "all") {
                run_all(this.name, [file]);
                return done();
            }

            if (file.indexOf("%s") !== -1) {
                file = require("util").format(file, this.target);
            }

            grunt.log.writeln(("Dumping DB to " + file + " ...").info);
            grunt.verbose.writeln("configuration", options);

            cmd = wrap_pwd("/usr/bin/pg_dump " + ["-c", "--no-acl", "-O"].concat(pgdump_args(options)).join(" "), options);

            if (/\.gz$/.test(file)) {
                cmd = [cmd, "gzip > " + file].join(" | ");
            } else {
                cmd = cmd + " > " + file;
            }

            exec(cmd, function() {
                done();
            });
        }
    );


    grunt.registerMultiTask(
        'pgsql-load',
        'Restore dump',
        function(file) {
            var options = get_options('pgsql-load', this.target),
                done = this.async(),
                cmd = "";

            if (this.target === "all") {
                run_all(this.name, [file]);
                return done();
            }

            grunt.log.writeln(("Loading DB with " + file + " ...").info);

            if (/\.gz$/.test(file)) {
                cmd = [
                    "gunzip -c " + file,
                    wrap_pwd('/usr/bin/psql ' + psql_args(options).concat(["-w", "-f -"]).join(" "), options)
                ].join(" | ");
            } else {
                cmd = wrap_pwd('/usr/bin/psql ' + ["-w", "-f", file].concat(psql_args(options)).join(" "), options);
            }

            exec(cmd, function() {
                done();
            });
        }
    );

    grunt.registerMultiTask(
        'pgsql-drop',
        'Drop tables and sequences',
        function() {
            var options = get_options('pgsql-drop', this.target),
                done = this.async();

            exec_sql("\\d", options, function(error, stdout, stderr) {
                var sequences = [],
                    tables = [];

                stdout.split("\n").forEach(function(e, k) {
                    if (k > 3) {
                      e = e.split("|").map(function(e) {return e.trim(); });

                        switch(e[2]) {
                            case "sequence":
                                sequences.push("DROP SEQUENCE '" + e[1] + "' CASCADE");
                                break;
                            case "table":
                                tables.push("DROP TABLE '" + e[1] + "' CASCADE");
                                break;
                        }

                    }
                });

                exec_sql(sequences.concat(tables).join("; "), options, function(error, stdout, stderr) {
                    grunt.log.writeln(stdout.info);
                    grunt.log.error(stderr);
                    done();
                });
            });
        }
    );



    grunt.registerMultiTask(
        'pgsql-drop-constraints',
        'Move constraints from given database to target database',
        function() {
            var options = get_options('pgsql-drop-constraints', this.target),
                done = this.async(),
                cmd = [
                    wrap_pwd('/usr/bin/psql ' + psql_args(options).join(" ") +' -w -c "SELECT \'ALTER TABLE \'||nspname||\'.\'||relname||\' DROP CONSTRAINT \'||conname||\';\' FROM pg_constraint INNER JOIN pg_class ON conrelid=pg_class.oid INNER JOIN pg_namespace ON pg_namespace.oid=pg_class.relnamespace ORDER BY CASE WHEN contype=\'f\' THEN 0 ELSE 1 END,contype,nspname,relname,conname"', options),
                    'grep ALTER',
                    wrap_pwd('/usr/bin/psql -w ' + psql_args(options).join(" ") +' -f -', options)
                ].join(" | ");

            exec(cmd, function() {
                done();
            });
        }
    );


    grunt.registerMultiTask(
        'pgsql-move-constraints',
        'Move constraints from given database to target database',
        function(destination) {
            var src_options = get_options('pgsql-move-constraints', this.target),
                dst_options = get_options('pgsql-move-constraints', destination),
                done = this.async();

            var cmd = [
                wrap_pwd('/usr/bin/psql -w ' + psql_args(src_options).join(" ") +' -c "SELECT \'ALTER TABLE \'||nspname||\'.\'||relname||\' ADD CONSTRAINT \'||conname||\' \'|| pg_get_constraintdef(pg_constraint.oid)||\';\' FROM pg_constraint INNER JOIN pg_class ON conrelid=pg_class.oid INNER JOIN pg_namespace ON pg_namespace.oid=pg_class.relnamespace ORDER BY CASE WHEN contype=\'f\' THEN 0 ELSE 1 END DESC,contype DESC,nspname DESC,relname DESC,conname DESC;"', src_options),
                '/bin/grep ALTER',
                wrap_pwd('/usr/bin/psql -w ' + psql_args(dst_options).join(" ") +' -f -', dst_options)
            ].join(" | ");

            exec(cmd, function() {
                done();
            });
        }
    );

    grunt.registerMultiTask(
        'pgsql-overwrite',
        'Display sqls needed to copy given query into another database without any warning. (pgsql-overwrite:target:sql:table)',
        function(sql, table) {
            var options = get_options('pgsql-overwrite', this.target),
                done = this.async();



            exec_sql(to_csv(sql), options, function(error, stdout, stderr) {
                var parse = require('csv-parse');

                parse(stdout.trim(), {comment: '#'}, function(err, output) {
                    var header = output[0];

                    output = output.slice(1);

                    var updates = output.map(function(line, kline) {

                        return "UPDATE " + table + " SET " +
                            line.map(function(v, k) {
                                return header[k] + " = '" + v + "'";

                            }).join(", ") +
                            " WHERE id = " + line[0];
                    });

                    updates.push("");

                    var inserts = output.map(function(line, kline) {
                        if (kline === 0) return;

                        return "INSERT INTO " + table + " (" + header.join(", ") + ") SELECT " +
                            line.map(function(v, k) {
                                return "'" + v + "'";
                            }).join(", ") +
                            " WHERE NOT EXISTS (SELECT 1 FROM " + table + " WHERE id = " + line[0] + ")";
                    });
                    inserts.push("");

                    console.log(updates.join(";\n"));
                    console.log(inserts.join(";\n"));

                    done();
                });
            });
        }
    );
};