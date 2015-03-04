/// <reference path="../typings/node/node.d.ts" />
/// <reference path="../typings/es6-promise/es6-promise.d.ts" />

/// <reference path="../typings/mocha/mocha.d.ts" />
/// <reference path="../typings/power-assert/power-assert.d.ts" />
/// <reference path="../typings/nexpect/nexpect.d.ts" />

/// <reference path="./cli_spec.ts" />
/// <reference path="./utils_spec.ts" />

require("es6-promise").polyfill();

try {
    // optional
    require("source-map-support").install();
} catch (e) {
}

import fs = require("fs");
import rimraf = require("rimraf");

import dtsm = require("../lib/index");
import fsgit = require("fs-git");

describe("Manager", ()=> {

    describe("#init", () => {

        var dtsmFilePath = "./test-tmp/dtsm.json";

        beforeEach(()=> {
            if (fs.existsSync(dtsmFilePath)) {
                fs.unlinkSync(dtsmFilePath);
            }
        });

        it("can create new dtsm.json", ()=> {
            return dtsm
                .createManager()
                .then(manager => {
                    manager.init(dtsmFilePath);
                    assert(fs.existsSync(dtsmFilePath));
                });
        });
    });

    describe("#search", ()=> {
        it("can find single file", ()=> {
            return dtsm
                .createManager()
                .then(manager => {
                    return manager.search("gae.channel").then(fileList => {
                        assert(fileList.length === 1);
                    });
                });
        });

        it("can find multiple files", ()=> {
            return dtsm
                .createManager()
                .then(manager => {
                    return manager.search("angular").then(fileList => {
                        assert(1 < fileList.length);
                    });
                });
        });
    });

    describe("#install", ()=> {

        var dtsmFilePath = "./test-tmp/install/dtsm.json";

        beforeEach(()=> {
            if (fs.existsSync(dtsmFilePath)) {
                fs.unlinkSync(dtsmFilePath);
            }
        });

        it("can install single file without save options", ()=> {
            return dtsm
                .createManager()
                .then(manager => {
                    return manager.install({save: false, dryRun: false}, ["jquery/jquery.d.ts"]).then(result => {
                        assert(Object.keys(result.dependencies).length === 1);
                        assert(!result.dependencies["jquery/jquery.d.ts"].error);
                        assert(!fs.existsSync(dtsmFilePath));
                    });
                });
        });

        it("can install single file with save options", ()=> {
            return dtsm
                .createManager({configPath: dtsmFilePath})
                .then(manager => {
                    manager.init(dtsmFilePath);

                    return manager.install({save: true, dryRun: false}, ["jquery/jquery.d.ts"]).then(result => {
                        assert(Object.keys(result.dependencies).length === 1);
                        assert(!result.dependencies["jquery/jquery.d.ts"].error);
                        assert(fs.existsSync(dtsmFilePath));

                        var json = fs.readFileSync(dtsmFilePath, "utf8");
                        var data = JSON.parse(json);
                        assert(data.dependencies["jquery/jquery.d.ts"]);
                    });
                });
        });

        it("can't install files if it found more than 1 file", ()=> {
            return dtsm
                .createManager()
                .then(manager => {
                    return manager.install({save: false, dryRun: false}, ["angul"]).then(result=> {
                        throw new Error("unexpected");
                        /* tslint:disable:no-unreachable */
                        return "";
                        /* tslint:enable:no-unreachable */
                    }, ()=> {
                        // TODO
                        return "OK";
                    });
                });
        });
    });

    describe("#installFromFile", ()=> {

        var dtsmFilePath = "./test/fixture/dtsm-installFromFile.json";
        var targetDir:string = JSON.parse(fs.readFileSync(dtsmFilePath, "utf8")).path;

        beforeEach(()=> {
            if (fs.existsSync(targetDir)) {
                rimraf.sync(targetDir);
            }
        });

        it("can install files from recipe", ()=> {
            assert(!fs.existsSync(targetDir));

            return dtsm
                .createManager({configPath: dtsmFilePath})
                .then(manager => {
                    return manager.installFromFile().then(result => {
                        assert(1 < result.dependenciesList.length); // atom.d.ts has meny dependencies
                        assert(fs.existsSync("test-tmp/installFromFile/atom/atom.d.ts"));
                    });
                });
        });
    });

    describe("#update", ()=> {

        var dtsmFilePath = "./test/fixture/dtsm-update.json";
        var targetDir:string = JSON.parse(fs.readFileSync(dtsmFilePath, "utf8")).path;

        beforeEach(()=> {
            if (fs.existsSync(targetDir)) {
                rimraf.sync(targetDir);
            }
        });

        it("can update files", ()=> {
            assert(!fs.existsSync(targetDir));

            return dtsm
                .createManager({configPath: dtsmFilePath})
                .then(manager => {
                    return manager.update({}).then(result => {
                        assert(1 === Object.keys(result.dependencies).length);
                        var dtsPath = "test-tmp/update/es6-promise/es6-promise.d.ts";
                        assert(fs.existsSync(dtsPath));

                        // check content
                        var updatedContent = fs.readFileSync(dtsPath, "utf8");
                        var depName = "es6-promise/es6-promise.d.ts";
                        var dep = result.dependencies[depName];
                        var originalRef:string = JSON.parse(fs.readFileSync(dtsmFilePath, "utf8")).dependencies[depName].ref;
                        return fsgit
                            .open(dep.repoInstance.targetDir, originalRef)
                            .then(repo => repo.readFile(depName, {encoding: "utf8"}))
                            .then(oldContent => {
                                assert(oldContent !== updatedContent);
                            });
                    });
                });
        });
    });

    describe("#uninstall", ()=> {

        var dtsmFilePath = "./test/fixture/dtsm-uninstall.json";
        var targetDir:string = JSON.parse(fs.readFileSync(dtsmFilePath, "utf8")).path;

        beforeEach(()=> {
            if (fs.existsSync(targetDir)) {
                rimraf.sync(targetDir);
            }
        });

        it("can update files", ()=> {
            assert(!fs.existsSync(targetDir));

            return dtsm
                .createManager({configPath: dtsmFilePath})
                .then(manager => {
                    return manager.uninstall({}, ["atom"]).then(resultList => {
                        assert(1 === resultList.length);
                    });
                });
        });
    });

    describe("#fetch", ()=> {
        it("can fetch from remote repos", ()=> {
            return dtsm
                .createManager()
                .then(manager => manager.fetch());
        });
    });
});
