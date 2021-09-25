import { exec } from "child_process";
import fs from "fs";
import { resolve } from "path";
import { promisify } from "util";

import * as cache from "../src/cache";

const execAsync = promisify(exec);

const FIXTURES_DIR = resolve(__dirname, "__fixtures__");
const FIXTURES_BACKUP_DIR = resolve(__dirname, "__fixtures-backup__");
const CACHE_DIR = (process.env.CACHE_DIR = resolve(__dirname, "__tmp__"));
const GITHUB_REPOSITORY = (process.env.GITHUB_REPOSITORY = "integration-test");

describe("save and restore files", () => {
    beforeEach(async () => {
        await fs.promises.rmdir(CACHE_DIR, { recursive: true });
        await fs.promises.rmdir(FIXTURES_BACKUP_DIR, { recursive: true });
        await execAsync(`git checkout ${resolve(FIXTURES_DIR)}`);
    });
    test("creates archive file", async () => {
        await cache.saveCache([FIXTURES_DIR], "save-test");
        await fs.promises.access(
            resolve(CACHE_DIR, GITHUB_REPOSITORY, "save-test.tar.lz4"),
            fs.constants.R_OK | fs.constants.W_OK
        );
    });
    test("restores single archive file", async () => {
        await cache.saveCache([FIXTURES_DIR], "restore-test");
        await fs.promises.rename(FIXTURES_DIR, FIXTURES_BACKUP_DIR);
        await fs.promises.rmdir(FIXTURES_DIR, { recursive: true });
        await cache.restoreCache([FIXTURES_DIR], "restore-test");
        await execAsync(`diff -Naur ${FIXTURES_DIR} ${FIXTURES_BACKUP_DIR}`);
    });

    test.skip("restore latest archive file", async () => {
        expect.assertions(1);
        try {
            const filePath = resolve(FIXTURES_DIR, "helloWorld.txt");
            await cache.saveCache([FIXTURES_DIR], "latest-archive-test-1");
            await fs.promises.unlink(filePath);
            await cache.saveCache([FIXTURES_DIR], "latest-archive-test-2");
            await fs.promises.rmdir(FIXTURES_DIR, { recursive: true });
            await cache.restoreCache([FIXTURES_DIR], "latest-archive-test");
            await fs.promises.access(
                filePath,
                fs.constants.R_OK | fs.constants.W_OK
            );
        } catch (e) {
            expect(e).toMatch("file not found error");
        }
    });
});
