# Table of contents

- [Introduction](#introduction)
- [License](#license)
- [Core concepts](#core-concepts)
  - [Project](#project)
  - [Definition](#definition)
    - [Schema version](#schema-version)
    - [Sources](#sources)
      - [Copy task](#copy-task)
      - [Interpolate task](#interpolate-task)
    - [Source volumes](#source-volumes)
    - [Asset volumes](#asset-volumes)
    - [Environmental variables](#environmental-variables)
    - [Compose files](#compose-files)
    - [After build tasks](#after-build-tasks)
      - [Execute service command task](#execute-service-command-task)
      - [Copy asset into container task](#copy-asset-into-container-task)
    - [Proxied ports](#proxied-ports)
    - [Summary items](#summary-items)
  - [Instance](#instance)
  - [Asset](#asset)
    - [Preparing asset for asset volume](#preparing-asset-for-asset-volume)
  - [Deploy key](#deploy-key)
- [Running using Docker image](#running-using-docker-image)
  - [Prerequisites](#prerequisites)
  - [Basic usage](#basic-usage)
  - [Usage with persistent data](#usage-with-persistent-data)
  - [Environment variables](#environment-variables)
    - [Controlling Docker Compose version](#controlling-docker-compose-version)
    - [Using external MongoDB instance](#using-external-mongodb-instance)
    - [Controlling location of persistent data](#controlling-location-of-persistent-data)
    - [Controlling instantiation](#controlling-instantiation)
    - [Controlling log level](#controlling-log-level)
- [Running using source](#running-using-source)
- [Example project](#example-project)
- [Technologies used](#technologies-used)
- [Recommendations](#recommendations)

## Introduction

**Feater** is a tool for **rapid deployment of selected features** of your web application **to isolated testing or demo environments**.

**It’s tech-agnostic.** It can be used regardless of languages or dependencies used in your project. This is possible because it uses Docker containers and Docker Compose configurations.

**It’s open-source.** It's released under MIT license. You can use it for free as well as modify it to suit your needs.

**It’s easy to use.** If your project has a Docker Compose setup and some build scripts you won't need much more to run it with Feater.

**It’s easy to host.** It runs inside Docker container and you can use it on your local machine or set up a dedicated server for it.

## License

Feater is released under MIT License. You can view license information [here](https://raw.githubusercontent.com/feater-dev/feater/master/LICENSE)

## Core concepts

There are few core concepts in Feater that need to be highlighted first. Starting from the bottom of their hierarchy:

- **instance** - it's a single build of some web application; it is running in a set of Docker containers, built using source code checked out from referenced commits, tags or branches of specified repositories and a Docker Compose setup provided by these sources;
- **definition** - contains a recipe for preparing instances; it specifies required sources and references commits, tags or branches, il also defines asset volumes that need to be created, commands that should be run, ports to be proxied to externally available domains etc.; since they can be easily altered it becomes very easy to prepare instances for individual feature branches;
- **asset** - a file that can be used as a source of data either by being extracted to a Docker volume or copied to a specified Docker container;
- **deploy key** - SSH key generated by Feater that should be added as deploy key to a specific private repository that needs to be cloned when preparing an instance;
- **project** - used to bundle definitions and assets.

These concepts will be discussed in more details in following sections, starting from the top ones this time.

### Project

Project is used to group together definitions and assets they will be referencing. This allows Feater to be used to provide instances multiple applications by defining a separate project for each and hence creating a set of isolated scopes.

The only property that needs to be provided for a project is its **name**.

### Definition

Definition provides a recipe for creating instances containing specific changes and features that need to be deployed using Feater. For each definition multiple independent instances can be provided. Depending on the way source references are defined and the time of their creation they will provide the most up-to-date versions of services that are to be tested or demoed.

The main part of each definition - apart of its **name** - is a recipe that provides information required by all stages of instance build. This recipe may be defined either using UI or imported using YAML format.

Each section of the recipe will be now discussed in more detail.

#### Schema version

First the schema version of the recipe needs to be defined if YAML format is to be used. Currently the only supported schema version is `0.1.0` and therefore each recipe needs to start with:

```yaml
schema_version: "0.1.0"
```

If recipe is defined using UI then provided settings will always be mapped to the latest schema version. On the server side all definition recipes are stored in YAML format.

#### Sources

This section allows you to define a list of repositories containing sources required for instance. They will be cloned and specified branches, tags or commits will be checked out for them.

Here is the UI view of sources section with a single source specified:

![Sources section of recipe form](https://github.com/feater-dev/feater/raw/master/docs/ui/recipe-form--sources.png)

And here is and example of the corresponding section in YAML recipe:

```yaml
sources:
- id: symfony_example
  clone_url: "https://github.com/feater-dev/symfony-example.git"
  use_deploy_key: false
  reference:
    type: branch
    name: master
  before_build_tasks:
  - type: copy
    source_relative_path: "app/config/parameters.yml.feater.dist"
    destination_relative_path: "app/config/parameters.yml"
  - type: interpolate
    relative_path: "app/config/parameters.yml"
  - type: copy
    source_relative_path: "web/app_dev.php.dist"
    destination_relative_path: "web/app_dev.php"
```

Following properties need to be defined for each source:

- **ID** - it will be used to reference given source later; it will also become a part of related environmental and substitution variable names as well as some internal paths;
- **clone URL** - specifies where given repository is located; both HTTPS and SSH links can be used (e.g. `https://github.com/feater-dev/symfony-example.git`, `git@github.com:feater-dev/symfony-example.git`); if HTTPS protocol is used then SSH deploy key cannot be utilized hence repository needs to be public; as no vendor-specific API is used neither for cloning nor for retrieving additional information about sources, they can be stored on GitHub/GitLab/BitBucket or any other Git server;
- **use deploy key** - specifies if deploy key should be generated and used for cloning repository; for each repository (identified by clone URL) only one deploy key will be generated; before building an instance all deploy keys listed for given definition should be added for respective repositories on Git server;
- **reference type** and **reference name** - specifies which revision of source should be checked out; in most cases you will use branch reference, but tag or commit are also available; depending on reference type value the meaning of reference name will change;
  - for `branch` type a branch name needs to be provided;
  - for `tag` type a tag name needs to be provided,
  - for `commit` type commit hash needs to be provided.
- **before build tasks** - a list of tasks that should be performed after source is cloned, but before Docker Compose setup is started; in most cases this will include preparing some config files (with Copy task) or replacing some values inside them using substitution variables (with Interpolate task); these tasks are executed for each in sequence, independently for each source.

##### Copy task

Copy task allows to copy one of files contained in the given source to a different path, also contained in the same source.

For this type of task you need to set `type` property to `copy` and specify following additional properties:

- **source relative path** - path to source file, relative to source root directory,
- **destination relative path** - destination path, also relative to source root directory.

In the example recipe given above  `app/config/parameters.yml.feater.dist` file is copied to `app/config/parameters.yml`.

##### Interpolate task

Interpolate task allows to modify in-place the contents of one of files contained in the given source by replacing substitution variables in it.

For this type of task you need to set `type` property to `interpolate` and specify following additional properties:

- **relative path** - a path to file that should be interpolated, relative to source root directory.

In the example given above substitution variables are interpolated in file `app/config/parameters.yml` which was previously copied.

Predicted substitution variables (either their exact names and values or their name patterns if exact values cannot be determined without creating an instance) can be seen in *Predicted substitutions* tab on definition details page. They include:

- instance ID and hash,
- proxy domains (using names prefixed with `proxy_domain__`),
- names of asset and source Docker volumes (using names prefixed with `asset_volume__` or `source_volume__`),
- environmental variables defined in recipe (using names prefixed with `env__`).

The delimiters for substitution tokens are `{{{` and `}}}`.

To give an example, if you want to provide to your application a proxy domain generated for service port identified as `symfony_app` using some configuration file, your configuration file should include a token `{{{proxy_domain__symfony_app}}}`. This will be replaced with proxy domain generated by Feater for a specific instance upon its creation.

#### Source volumes

This section allows you to define a list of Docker volumes that will be created to mount source code to services/containers run when instance is created (as Feater doesn't allow host paths to be mounted).

Here is the UI view of source volumes section with two source volumes specified:

![Source volumes section of recipe form](https://github.com/feater-dev/feater/raw/master/docs/ui/recipe-form--source-volumes.png)

And here is an example of the corresponding section in YAML recipe:

```yaml
source_volumes:
- id: symfony_example
  source_id: symfony_example
- id: symfony_example_src
  source_id: symfony_example
  relative_path: src
```

Following properties need to be defined for each source volume:

- **ID** - will be used to reference referenced source volume and generate names for related environmental variable;
- **source ID** - references source that should be copied to given source volume;
- **relative path** - can be provided to copy a subdirectory of source instead of its root directory; for each source many independent source volumes can be created if needed and this setting should be useful when mono-repository pattern is used for organizing source code.

Note that the volume ID provided here is not the volume ID used by Docker. The latter is generated automatically and prefixed for each instance to avoid conflicts. It is then made available via:

- environmental variable named `FEATER__SOURCE_VOLUME__{id}`, where `{id}` part is replaced with an uppercase version of asset volume ID provided in recipe; this allows to add source volumes to Docker Compose configuration as external volumes and mount them to selected services;
- substitution variable named `source_volume__{id}`, where  `{id}` part is replaced with a lowercase version of asset volume ID provided in recipe.

The example Docker Compose setup that would allow to use an external source volume created this way will look like this:

```yaml
version: "3"

services:

  symfony_app:
    volumes:
      - "symfony_example:/var/www/html"
    # ...

volumes:
  symfony_example:
    external:
      name: "$FEATER__SOURCE_VOLUME__SYMFONY_EXAMPLE"
```

#### Asset volumes

This section allows you to define a list of Docker volumes that will be pre-populated with data from specified assets and will be mounted to selected services defined in Docker Compose configuration.

Here is the UI view of asset volumes section with a single asset volume specified:

![Asset volumes section of recipe form](https://github.com/feater-dev/feater/raw/master/docs/ui/recipe-form--asset-volumes.png)

And here is an example of the corresponding section in YAML recipe:

 ```yaml
asset_volumes:
- id: test_db
  asset_id: test_db_volume
```

Following properties need to be defined for each asset volume:

- **ID** - will be used to reference referenced asset volume and generate names for related environmental variable;
- **asset ID** - references the asset that should be used to pre-populate volume with data; if omitted then an empty volume will be created.

Referenced asset needs to be `.tar.gz` archive. It will be decompressed to populate the asset volume with data. In example above we assume that asset with ID `test_db_volume` is available and it is a `tar.gz` archive.

Note that the volume ID provided here is not the volume ID used by Docker. The latter is generated automatically and prefixed for each instance to avoid conflicts. It is then made available via:

- environmental variable named  `FEATER__ASSET_VOLUME__{id}`, where  `{id}` part is replaced with an uppercase version of asset volume ID provided in recipe; this allows to add asset volumes to Docker Compose configuration as external volumes and mount them to selected services;
- substitution variable named `asset_volume__{id}`, where  `{id}` part is replaced with a lowercase version of asset volume ID provided in recipe.

In the example above a named Docker volume will be created by extracting `.tar.gz` archive stored as asset with ID `test_db_volume`. The name given to this volume will follow the pattern `featerinstance{instance_hash}_asset_volume_test_db` and it will be available via `FEATER__ASSET_VOLUME__TEST_ELASTICSEARCH` environmental variable as well as via `asset_volume__test_db` substitution variable.

The example Docker Compose setup that would allow to use an external source volume created this way will look like this:

```yaml
version: "3"

services:

  symfony_db:
    volumes:
      - "test_db:/var/lib/mysql"

volumes:
  test_db:
    external:
      name: "$FEATER__ASSET_VOLUME__TEST_DB"
```

#### Environmental variables

This sections specifies environmental variables that are used instead of `.env` file when Docker Compose setup is run, along with some additional env variables provided automatically by Feater.

Here is the UI view of environmental variables section with three environmental variables specified:

![Environmental variables section of recipe form](https://github.com/feater-dev/feater/raw/master/docs/ui/recipe-form--environmental-variables.png)

And here is an example of the corresponding section in YAML recipe:

```yaml
env_variables:
- name: DATABASE_USER
  value: user
- name: DATABASE_PASSWORD
  value: pass
- name: DATABASE_NAME
  value: employees
```

Note that Feater will not use `.env` file and hence it is required to move all environmental variables listed in it to the recipe.

For each entry in this section a **name** and a **value** of given environmental variable needs to be provided. It's important to remember that these values will be treated as strings regardless of data they contain. They also will not be available inside specific containers if they are not made available for them by including them in respective service entries in Docker Compose configuration file using `environment` key.

Predicted environmental variables generated by Feater (either exact names and values or corresponding patterns if exact values cannot be determined before creating an instance) can be seen in *Predicted environment* tab on defintion details page. They include instance ID and hash, proxy domains and names of asset and source volumes. Their names are prefixed with `FEATER_`, except for `COMPOSE_PROJECT_NAME` used by Docker Compose.

#### Compose files

This section specifies in which source Docker Compose configuration is located and which files should be used.

Here is the UI view of compose files section:

![Compose files section of recipe form](https://github.com/feater-dev/feater/raw/master/docs/ui/recipe-form--compose-files.png)

And here is an example of the corresponding section in YAML recipe:

```yaml
compose_files:
- source_id: symfony_example
  env_dir_relative_path: .docker
  compose_file_relative_paths:
  - ".docker/docker-compose.base.yml"
  - ".docker/docker-compose.feater.yml"
```

Currently only one Docker Compose setup can be used, therefore this section should contain only one item.

Following properties need to be defined for the single entry in this section:

- **source ID** - references source in which Docker Compose setup is included; this source does not have to be mounted to any service/container, i.e. source volume doesn't have to be created for it;
- **env directory relative path** - path to working directory where `docker-compose build` should be run relative to source root directory;
- **Compose file relative paths** - one or more path to Docker Compose setup files relative to source root directory; if multiple files are referenced then the usual rules for merging or overwriting specific settings apply; for more details on this consult [multiple-compose-files](https://docs.docker.com/compose/extends/#multiple-compose-files).

#### After build tasks

This section lists the tasks that should be performed after Docker Compose setup for given instance is run. There are few types of tasks available.

Here is the UI view of after build tasks section with few tasks specified:

![After build tasks section of recipe form](https://github.com/feater-dev/feater/raw/master/docs/ui/recipe-form--after-build-tasks.png)

And here is an example of the corresponding section in YAML recipe:

```yaml
after_build_tasks:
- type: execute_service_command
  id: filesystem_acl
  service_id: symfony_app
  inherited_env_variables: []
  custom_env_variables: []
  command:
  - bash
  - '-c'
  - ./scripts/filesystem-acl.sh
- type: execute_service_command
  id: build
  depends_on:
  - filesystem_acl
  service_id: symfony_app
  inherited_env_variables: []
  custom_env_variables: []
  command:
  - bash
  - '-c'
  - ./scripts/build.sh    -
- type: copy_asset_into_container
  service_id: symfony_app
  asset_id: sample_photos
  destination_path: /var/www/html/web/uploads/photos
```

Regardless of after build task type it is possible to control the order of executing them by providing these optional properties for some of them:

- **ID** - can be used to reference given task later in other tasks' **depends on** property so that its completion will be required before starting dependant tasks;
- **depends on** - can list IDs of after build tasks that need to be completed before given task should be executed;

Other properties will depend on the type of given task.

##### Execute service command task

This type of task allows to execute commands on running service container. It will use `docker exec` internally and requires following properties need to be provided:

- **service ID** - identifies on which service/container given command should be executed; service key from Docker Compose setup should be used here;
- **command** and **arguments** - defines the command to be executed and its arguments.

In case of this command it is possible also to define environmental variables that should be available for it. This can be done in two ways:

- either explicitly by using **custom environmental variables** section; in this case a list of name and value pairs needs to be provided;
- or by inheriting some variables from environmental variables defined for definition or these generated automatically by Feater (e.g. proxy domains, volume names); it is possible to alter their names if required by providing aliases for them.

##### Copy asset into container task

This type of task allows to copy any asset from the current project to any service/container comprising an instance. This is different from copy file before build task, as the previous is run when containers are not started and is limited to handling files inside a single source.

Following properties need to be provided in this case:

- **service ID** - identifies on which service/container given command should be executed; service key from Docker Compose setup should be used here;
- **asset ID** - defines which asset should be copied,
- **destination path** - defines absolute path where asset should be copied to.

#### Proxied ports

This section specifies which service/container ports should be proxied to externally available domains.

When preparing Docker Compose setup to be used by Feater it’s not possible to expose ports property directly in `docker-compose.yml` as this would make building and running several instances in parallel impossible. Instead it is necessary to specify in the recipe which ports for specified service/container should be exposed and proxied to domains that will be automatically generated by Feater.

Note that currently only HTTP protocol (on port 80) is proxied.

Here is the UI view of proxied ports section with two proxied ports specified:

![Proxied ports section of recipe form](https://github.com/feater-dev/feater/raw/master/docs/ui/recipe-form--proxied-ports.png)

And here is an example of the corresponding section in YAML recipe:

```yaml
proxied_ports:
- id: sf
  service_id: symfony_app
  port: 8000
  name: Symfony application
- id: mail
  service_id: symfony_mailcatcher
  port: 1080
  name: Mailcatcher
  nginx_config_template: >-
    # Proxy port {{{port}}} of {{{service_id}}} running at {{{ip_address}}}
    server {
      listen 9011;
      listen [::]:9011;
      server_name {{{proxy_domain}}};
      location / {
        proxy_pass http://{{{ip_address}}}:{{{port}}};
        proxy_set_header Host $host;
      }
    }
```

For a port of specified service/container to be proxied it's required to provide:

- **ID** - it will be used as a part of generated domain; it should be unique for given recipe;
- **name** - a human-readable name that will be presented in UI when listing proxied ports;
- **service ID** - should reference one of services defined in Docker Compose setup; to reference service its key from Docker Compose setup should be used;
- **proxied port** - the number of port to be proxied;
- **Nginx configuration template** - can be provided optionally if there are some specific settings that given service requires; if not provided then a basic default template will be used.

#### Summary items

This section specifies items to be shown in build summary, typically for displaying links to specific services based on proxied domains, database DSNs etc.

Here is the UI view of summary items section with two summary items specified:

![Summary items section of recipe form](https://github.com/feater-dev/feater/raw/master/docs/ui/recipe-form--summary-items.png)

And here is an example of the corresponding section in YAML recipe:

```yaml
summary_items:
- name: Symfony is app available at
  value: http://{{{proxy_domain__sf}}}
- name: Database DSN
  value: mysql://{{{env__database_user}}}:{{{env__database_password}}}@symfony_db/{{{env__database_name}}}
```

For each entry in this section a **name** and a **value** of given summary item needs to be provided. The value will be interpolated using substitution variables in the same way as it is done for before build interpolate task.

### Instance

When instance is created following details about it are available in UI:

- in **Summary** tab:
  - name of the instance;
  - definition and project;
  - build status and build time;
  - timestamps for build start and end;
  - list of summary items;
- in **Environment** tab - a list names and values of environmental variables provided in definition recipe or generated by Feater;
- in **Services** tab:
  - a list of services/containers created for given instance with their container IDs, IP address, state;
  - it is also possible to start/stop/pause/resume individual containers here;
  - also logs that would be accessible with `docker logs` command can be downloaded here;
- in **Proxy domains** tab - a list of proxied ports and domains generated for them;
- in **Build logs** tab - logs of each stage of instance creation is available to allow troubleshooting.

### Asset

Asset is a file uploaded to Feater that can be used either to create asset volumes (if it is a `.tag.gz` archive) or can be copied into service/container user after build task (regardless of its MIME type).

#### Preparing asset for asset volume

A popular use case for using asset volume would be pre-populating databases.

One approach would be to just copy asset (which in this case would be a database dump) into container and importing it during after build task. However this solutions results in database not being available immediately when container starts. Also more time will be required to complete instance creation as imported file needs to be processed by database server.

A better solution is to prepare data volume containing all files required for our database beforehand as it will be mounted immediately when `docker-compose` starts our services.

Let's assume we are using MySQL 5.7 database and that we will be using [datacharmer/test_db](https://github.com/datacharmer/test_db) as our sample database.

First we need to create `.tar.gz` file that we can upload to Feater later. We can use standalony MySQL container for this. Let's assume we have the sample database checked out in `/home/me/test_db`. We will start with a simple `docker-compose.yml`:

```yaml
version: '3.3'

services:

  mysql:
    image: mysql:5.7
    volumes:
      - "/home/me/test_db:/data"
      - "mysql_data:/var/lib/mysql"
    environment:
      MYSQL_RANDOM_ROOT_PASSWORD: "yes"
      MYSQL_USER: "user"
      MYSQL_PASSWORD: "pass"
      MYSQL_DATABASE: "employees"

volume:
  mysql_data: ~
```

We will run it with `COMPOSE_PROJECT_NAME=testdb docker-compose up -d` and then we'll enter the container and run `bash` in it:

```bash
docker exec -it testdb_mysql_1 bash
```

Inside the container we will execute following commands:

```bash
cd /data
mysql -uuser -ppass < employees.sql
```

We exit container and then we use another container to compress the contents of `db_data` volume to `.tar.gz` file.

```bash
docker run --rm \
  -v testdb_mysql_data:/source \
  -v /home/me/test_db_asset:/target \
  alpine \
  sh -c "(cd /source && tar -zcvf /target/test_db_asset.tar.gz *)"
```

After running the command above we should have volume archive available in `/home/me/test_db_asset/test_db_asset.tar.gz`. We can use it to create an in Feater asset with ID `test_db_asset`.

Our definition recipe YAML file would now have to include following section:

```yaml
asset_volumes:
- id: test_db
  asset_id: test_db_asset
```

Corresponding Docker Compose setup may look like this to allow to provide an external volume and to map its name provided via `FEATER__ASSET_VOLUME__TEST_DB` environmental variable to `test_db_data` that is used internally:

```yaml
version: '3.3'

services:
  # Some application containers here.
  mysql:
    image: mysql:5.7
    volumes:
      - "test_db_data:/var/lib/mysql"
    environment:
      MYSQL_RANDOM_ROOT_PASSWORD: "yes"
      MYSQL_USER: "user"
      MYSQL_PASSWORD: "pass"
      MYSQL_DATABASE: "employees"

volumes:
  test_db_data:
    external:
      name: ${FEATER__ASSET_VOLUME__TEST_DB}
```

Note that values of config variables related to MySQL credentials should remain the same, because they are also stored in the asset we've created.

### Deploy key

For each repository that is referenced in sources section of definition recipes that is marked as requiring SSH deploy key for cloning, Feater will generate a deploy key that has to be added to repository settings on GitHub/GitLab/BitBucket before attempting instances creation. Repository is identified by its clone URL so even if it will be referenced in multiple recipes only one SSH deploy key will be generated.

The full list of deploy keys is available from the side menu, and also each definition details contain _Deploy keys_ tab that lists only these items that are relevant for given recipe.

It is possible to remove all unneeded SSH deploy keys (i.e. these that are no longer referenced by any definition recipe). It is also possible to remove individual deploy keys, as well as generate them again for any repository that is marked as requiring them for cloning.

Public parts of SSH deploy keys are stored in MongoDB, while private parts are stored on data volume as this form is required by `sshpass` that is passed to `git clone` command via `GIT_SSH_COMMAND` environmental variable.

## Running using Docker image

The easiest way to use Feater is to use one of images available at [DockerHub](https://hub.docker.com/r/feater/feater). The only requirement for using Feater is that Docker is installed on your machine.

### Prerequisites

Before running Feater you should check Docker version installed on your machine to use the image matching it:

```bash
$ docker --version
Docker version 18.06.0-ce, build 0ffa825
```

In this case image `feater/feater:*-docker-18.06.3` should be used.

You also need to create Docker network that will be used to expose some of the instantiated services:

```bash
$ docker network create feater_proxy
56fe08e1c62030daa5992566e8595bbd58c2fa4acf3d4a262d2dbb62050a7290
```

### Basic usage

If you want to try out Feater you can run it without mounting any volumes for persisting data. Be aware that in this case after removing its container all data will be lost. See following sections to find out how data can be persisted independently of Feater container.

When running Feater it is necessary to:

- mount Docker socket at `/var/run/docker.sock`;
- provide Docker proxy network name using `FEATER_PROXY_NETWORK_NAME` environmental variable;
- map port 9010 where Feater UI is available;
- map port 9011 where instantiated services are proxied.

Assuming port 80 is not in use on your machine following command can be used:

```bash
$ docker run \
    -p 9010:9010 \
    -p 80:9011 \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -e FEATER_PROXY_NETWORK_NAME=feater_proxy \
    -d \
    --name feater \
    feater/feater:latest-docker-18.06.3
```

You can now access Feater's UI at `http://localhost:9010`.

Instantiated services will be proxied using domain names following pattern `{instance_hash}-{port_id}.featerinstance.localhost` and balanced using Nginx on port 9011 of the Feater container, which is now mapped to `localhost`'s port 80. In this case you should be able to access them in your web browser without any additional configuration.

### Usage with persistent data

Inside Feater container data are persisted in following directories:

- `/data/asset` - stores uploaded assets;
- `/data/build` - temporarily stores sources before they are copied to volumes;
- `/data/identity` - stores private parts of deploy keys that are used to clone private repositories over SSH;
- `/data/mongo` - stores data persisted in MongoDB about projects, definitions, assets, instances, deploy keys, logs; instead of MongoDB installed inside Feater container external MongoDB can be used;
- `/data/proxy` - stores Nginx configurations for proxied instantiated services.

In case you want to persist these information even if Feater container is
removed mount some volumes to paths listed above, or simply to `/data` path:

```bash
$ docker volume create feater_data

$ docker run \
    -p 9010:9010 \
    -p 80:9011 \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v feater_data:/data \
    -e FEATER_PROXY_NETWORK_NAME=feater_proxy \
    -d \
    --name feater \
    feater/feater:latest-docker-18.06.3
```

You can also include `--restart unless-stopped` option if you want Feater to run continuously and to be started automatically.

### Environment variables

Following environmental variables can be provided when executing `docker run`.

#### Controlling Docker Compose version

- `FEATER_DOCKER_COMPOSE_VERSION` - defaults to `1.23.2`.

#### Using external MongoDB instance

- `FEATER_MONGO_DSN` - DSN of MongoDB database to be used for persisting projects, definitions, assets, instances, deploy keys and logs; can be provided if external instance of MongoDB should be used; defaults to `mongodb://localhost:27017/feater`.

#### Controlling location of persistent data

- `FEATER_GUEST_PATH_ASSET` - defaults to `/data/asset`;
- `FEATER_GUEST_PATH_BUILD` - defaults to `/data/build`;
- `FEATER_GUEST_PATH_IDENTITY` - defaults to `/data/identity`;
- `FEATER_GUEST_PATH_PROXY` - defaults to `/data/proxy`.

#### Controlling instantiation

- `FEATER_CONTAINER_NAME_PREFIX` - the prefix that will be used for generating `COMPOSE_PROJECT_NAME` for instantiated services; note that some versions of Docker will remove all characters other that letters and digits; if your version of Docker allows to use underscore it is convenient to append it to the end of this prefix; defaults to `featerinstance`;
- `FEATER_PROXY_DOMAIN_PATTERN` - the pattern for proxy domains generated for instantiated services; tokens `{instance_hash}` and `{port_id}` will be replaced with values specific for given instance and proxied port; defaults to `{instance_hash}-{port_id}.featerinstance.localhost`;
- `FEATER_PROXY_NETWORK_NAME` - the name of the Docker network to which all proxied instantiated services are connected after being run; defaults to `feater_proxy`.

#### Controlling log level

- `FEATER_LOG_LEVEL_CONSOLE` - specifies log level that will be outputted to console; defaults to `info`;
- `FEATER_LOG_LEVEL_MONGO` - specifies log level that will be persisted in MongoDB; defaults to `info`.

## Running using source

For developing Feater it is better to build image from source and run server and client components in watch mode, where source changes will result in recompiling and restarting them. This is possible using [.docker/run.sh](https://github.com/feater-dev/feater/blob/develop/.docker/run.sh) script.

This script allows to use the same environmental variables as the image described before plus an extra `FEATER_ENV` variable that can be set to either `dev` or `prod`.

If `prod` environment is selected the production builds of server and client components will be built and the result will be similar to using image from Docker Hub directly.

If `dev` environment is selected then Nodemon will be used instead of PM2 to run the server component, and the client component will be served in watch mode. They both will be reloaded if some source code changes are made.

## Example project

Example project is available [here](https://github.com/feater-dev/symfony-example). It provides a simple Symfony 3.4 based application along with MySQL, Elasticsearch and MailCatcher services.

## Technologies used

Following technologies were used to create Feater:

- [TypeScript](https://www.typescriptlang.org/)
- [Node.js 10](https://nodejs.org/en/)
- [Angular 7](https://angular.io/)
- [Nest](https://nestjs.com/)
- [GraphQL](https://graphql.org/)
- [MongoDB](https://www.mongodb.com/)
- [Nginx](https://www.nginx.com/)

## Recommendations

For inspecting containers run with Feater you can use [Portainer](https://www.portainer.io/).
