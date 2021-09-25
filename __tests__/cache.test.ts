import fs from "fs";
import { exec } from "child_process";
import { resolve } from "path";
import { promisify } from "util";

import * as cache from "../src/cache";

const execAsync = promisify(exec);

const FIXTURES_DIR = resolve(".", "__tests__", "__fixtures__");
const FIXTURES_BACKUP_DIR = resolve(".", "__tests__", "__fixtures-backup__");

const CACHE_DIR = (process.env["CACHE_DIR"] = resolve(
    ".",
    "__tests__",
    "__tmp__"
));

beforeAll(async () => {
    await fs.promises.rmdir(CACHE_DIR, { recursive: true });
    await fs.promises.rmdir(FIXTURES_BACKUP_DIR, { recursive: true });
});

beforeEach(async () => {
    await execAsync(`git checkout ${resolve(FIXTURES_DIR)}`);
});

describe("save", () => {
    test("creates archive file", async () => {
        await cache.saveCache([FIXTURES_DIR], "save-test");
        await fs.promises.access(
            resolve(CACHE_DIR, "save-test.tar.lz4"),
            fs.constants.R_OK | fs.constants.W_OK
        );
    });
});

describe("restore", () => {
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
