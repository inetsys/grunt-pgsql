# grunt-pgsql

> Basic functionality for managing PostgreSQL

> taks: pgsql-load, pgsql-dump, pgsql-drop, pgsql-drop-constraints, pgsql-move-constraints

## Getting Started
This plugin requires [Grunt](http://gruntjs.com/) `0.4.*`, psql & pg_dump command.

```shell
npm install grunt-pgsql --save-dev
```

Once the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

```js
grunt.loadNpmTasks('grunt-pgsql');
```

## The "pgsql-*" tasks

### Overview
In your project's Gruntfile, add a section named `pgsql` to the data object passed into `grunt.initConfig()`.

```js
grunt.initConfig({
  "pgsql-********": {
    options: {
      db: {
        host: "127.0.0.1",
        name: "database",
        user: "user",
        password: "password",
        charset: "UTF8"
      }
    }
  },
});
```

### Options

#### options.db.host
Type: `String`
Default value: `127.0.0.1`

Database host

#### options.db.name
Type: `String`
Default value: `database`

Database name

#### options.db.user
Type: `String`
Default value: `user`

Database user

#### options.db.password
Type: `String`
Default value: `password`

Database password. Notice that will be displayed in console...

#### options.db.charset
Type: `String`
Default value: `charset`

No use atm

### MultiTasks

#### pgsql-dump:target:file

Dump a database

There is a special case: `all` that loop through all targets and run them (*so dump **all** databases*), given file must have "%s" as replacement for each target name.

```bash
grunt pgsql-dump:[target]:dump.gz
grunt pgsql-dump:[target]:dump.txt

grunt pgsql-dump:all:%.txt
```

#### pgsql-load:target:file

Load given dump

When target is **all**, loop through all target and run them -> *load **all** databases*. File must have "%s" that will be replaced by the target name.

```bash
grunt pgsql-load:[target]:dump.gz
grunt pgsql-load:[target]:dump.txt
```

#### pgsql-overwrite:target:sql:dst_table

Display sqls needed to copy given query into another database without any warning.

```bash
grunt pgsql-safe-overwrite:solutraza_testing:"select * from src_table":dst_table > querys.sql
```

#### pgsql-drop

Drop all tables and constraints

```bash
grunt pgsql-pgsql:drop:[target]
```

#### pgsql-drop-constraints

Drop constraints

```bash
grunt pgsql-drop-constraints:[target]
```

#### pgsql-move-constrants

Create constraints found in target into the given database.

*Notice* Both targets must be defined in `pgsql-move-constrants`

```bash
grunt pgsql-move-constrants:[src_target]:dst_target
```
