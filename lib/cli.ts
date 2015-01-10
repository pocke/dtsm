/// <reference path="../typings/update-notifier/update-notifier.d.ts" />
/// <reference path="../node_modules/commandpost/commandpost.d.ts" />

import updateNotifier = require("update-notifier");
var pkg = require("../package.json");

var notifier = updateNotifier({
    packageName: pkg.name,
    packageVersion: pkg.version
});
if (notifier.update) {
    notifier.notify();
}

import readline = require("readline");

import dtsm = require("./index");
import pmb = require("packagemanager-backend");

import commandpost = require("commandpost");

interface RootOptions {
    offline:boolean;
    config:string[];
    remote:string[];
    insight:string[];
}

var root = commandpost
    .create<RootOptions, {}>("dtsm")
    .version(pkg.version, "-v, --version")
    .option("--insight <use>", "send usage opt in/out. in = `--insight true`, out = `--insight false`")
    .option("--offline", "offline first")
    .option("--remote <uri>", "uri of remote repository")
    .option("--config <path>", "path to json file")
    .action(()=> {
        process.stdout.write(root.helpText() + '\n');
    });

root
    .subCommand("init")
    .description("make new dtsm.json")
    .action(()=> {
        setup(root.parsedOpts)
            .then(manager => {
                var jsonContent = manager.init();

                console.log("write to " + manager.configPath);
                console.log(jsonContent);
            })
            .catch(errorHandler);
    });

interface SearchOptions {
    raw:boolean;
}

interface SearchArguments {
    phrase: string;
}

root
    .subCommand<SearchOptions, SearchArguments>("search [phrase]")
    .description("search .d.ts files")
    .option("--raw", "output search result by raw format")
    .action((opts, args) => {
        setup(root.parsedOpts)
            .then(manager => {
                return manager.search(args.phrase || "");
            })
            .then(resultList => {
                if (opts.raw) {
                    resultList.forEach(result => {
                        console.log(result.fileInfo.path);
                    });
                } else {
                    if (resultList.length === 0) {
                        console.log("No results.");
                    } else {
                        console.log("Search results.");
                        console.log("");
                        resultList.forEach(result => {
                            console.log("\t" + result.fileInfo.path);
                        });
                    }
                }
            })
            .catch(errorHandler);
    });

root
    .subCommand("fetch")
    .description("fetch all data from remote repos")
    .action(()=> {
        setup(root.parsedOpts)
            .then(manager=> {
                process.stdout.write("fetching...\n");
                return manager.fetch();
            })
            .catch(errorHandler);
    });

interface InstallOptions {
    save:boolean;
    dryRun: boolean;
    stdin: boolean;
}

interface InstallArguments {
    files: string[];
}

root
    .subCommand<InstallOptions, InstallArguments>("install [files...]")
    .description("install .d.ts files")
    .option("--save", "save .d.ts file path into dtsm.json")
    .option("--dry-run", "save .d.ts file path into dtsm.json")
    .option("--stdin", "use input from stdin")
    .action((opts, args) => {
        // .action((...targets:string[])=> {

        setup(root.parsedOpts)
            .then(manager=> {
                if (!opts.stdin && args.files.length === 0) {
                    manager.installFromFile({dryRun: opts.dryRun})
                        .then(result => {
                            Object.keys(result.dependencies).forEach(depName => {
                                console.log(depName);
                            });
                        })
                        .catch(errorHandler);
                } else if (args.files.length !== 0) {
                    manager.install({save: opts.save, dryRun: opts.dryRun}, args.files)
                        .then(result => {
                            Object.keys(result.dependencies).forEach(depName => {
                                console.log(depName);
                            });
                        })
                        .catch(errorHandler);
                } else {
                    var rl = readline.createInterface({
                        input: process.stdin,
                        output: process.stdout
                    });
                    rl.on("line", (line:string)=> {
                        manager.install({save: opts.save, dryRun: opts.dryRun}, [line])
                            .then(result => {
                                Object.keys(result.dependencies).forEach(depName => {
                                    console.log(depName);
                                });
                            })
                            .catch(errorHandler);
                    });
                }
            })
            .catch(errorHandler);
    });

commandpost.exec(root, process.argv);

function setup(opts:RootOptions):Promise<dtsm.Manager> {
    "use strict";

    var offline = opts.offline;
    var configPath:string = opts.config[0];
    var remoteUri:string = opts.remote[0];
    var insightStr = opts.insight[0];
    var insightOptout:boolean;

    if (typeof insightStr === "string") {
        if (insightStr !== "true" && insightStr !== "false") {
            return Promise.reject("--insight options required \"true\" or \"false\"");
        } else if (insightStr === "true") {
            insightOptout = false; // inverse
        } else {
            insightOptout = true; // inverse
        }
    }

    var repos:pmb.RepositorySpec[] = [];
    if (remoteUri) {
        repos.push({
            url: remoteUri
        });
    }
    var options:dtsm.Options = {
        configPath: configPath || "dtsm.json",
        repos: repos,
        offline: offline,
        insightOptout: insightOptout
    };
    return dtsm
        .createManager(options)
        .then(manager => {
            return manager.tracker
                .askPermissionIfNeeded()
                .then(()=> manager);
        });
}

function errorHandler(err:any) {
    "use strict";

    console.error(err);
    return Promise.resolve(null).then(()=> {
        process.exit(1);
    });
}
