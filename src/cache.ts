import { exec, PromiseWithChild } from "child_process";
import filenamify from "filenamify";
import { readdir } from "fs";
import { dirname, join } from "path";
import { promisify } from "util";

const execAsync = promisify(exec);
const readDirAsync = promisify(readdir);

export class ReserveCacheError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ReserveCacheError";
        Object.setPrototypeOf(this, ReserveCacheError.prototype);
    }
}

export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ValidationError";
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}

function checkPaths(paths: string[]): void {
    if (!paths || paths.length === 0) {
        throw new ValidationError(
            `Path Validation Error: At least one directory or file path is required`
        );
    }
}

function checkKey(key: string): void {
    if (key.length > 255) {
        throw new ValidationError(
            `Key Validation Error: ${key} cannot be larger than 255 characters.`
        );
    }
    const regex = /^[^,]*$/;
    if (!regex.test(key)) {
        throw new ValidationError(
            `Key Validation Error: ${key} cannot contain commas.`
        );
    }
}

async function streamOutputUntilResolved(
    promise: PromiseWithChild<unknown>
): Promise<unknown> {
    const { child } = promise;
    const { stdout, stderr } = child;

    if (stdout) {
        stdout.on("data", data => {
            console.log(`Received chunk ${data}`);
        });
    }

    if (stderr) {
        stderr.on("data", data => {
            if (!data) {
                return;
            }
            console.error(`Received error chunk ${data}`);
        });
    }

    return promise;
}

function locateCache(
    potentialCaches,
    cacheFiles
): { cache: string; key: string } | boolean {
    for (const potentialCache of potentialCaches) {
        for (const cacheFile of cacheFiles) {
            if (cacheFile.indexOf(potentialCache) !== -1) {
                return { cache: cacheFile, key: potentialCache };
            }
        }
    }
    return false;
}

/**
 * Restores cache from keys
 *
 * @param paths a list of file paths to restore from the cache
 * @param primaryKey an explicit key for restoring the cache
 * @param restoreKeys an optional ordered list of keys to use for restoring the cache if no cache hit occurred for key
 * @returns string returns the key for the cache hit, otherwise returns undefined
 */
export async function restoreCache(
    paths: string[],
    primaryKey: string,
    restoreKeys?: string[]
): Promise<string | undefined> {
    checkKey(primaryKey);
    checkPaths(paths);

    console.log(JSON.stringify({ paths, primaryKey, restoreKeys }, null, 2));

    const cacheDir = join(`/media/cache/`, process.env.GITHUB_REPOSITORY || "");

    // 1. check if we find any dir that matches our keys from restoreKeys

    const mkdirPromise = execAsync(`mkdir -p ${cacheDir}`);

    // @todo order files by name/date

    await streamOutputUntilResolved(mkdirPromise);

    const cacheFiles = await readDirAsync(cacheDir);

    const potentialCaches = (Array.isArray(restoreKeys) && restoreKeys.length
        ? restoreKeys
        : [primaryKey]
    ).map(key => filenamify(key));

    console.log(JSON.stringify({ potentialCaches }, null, 2));

    const result = locateCache(potentialCaches, cacheFiles);

    if (typeof result !== "object") {
        console.log("Unable to locate fitting cache file", {
            restoreKeys,
            primaryKey,
            cacheFiles,
            potentialCaches
        });
        return undefined;
    }

    const { key, cache } = result;

    const cachePath = join(cacheDir, cache);

    const cmd = `lz4 -d -v -c ${cachePath} | tar xf - -C ${dirname(paths[0])}`;

    // --skip-old-files

    console.log(
        JSON.stringify({ cacheDir, cache, cachePath, key, cmd }, null, 2)
    );

    // 2. if we found one, rsync it back to the HD
    const createCacheDirPromise = execAsync(cmd);

    await streamOutputUntilResolved(createCacheDirPromise);

    return key;
}

/**
 * Saves a list of files with the specified key
 *
 * @param paths a list of file paths to be cached
 * @param key an explicit key for restoring the cache
 * @returns number returns cacheId if the cache was saved successfully and throws an error if save fails
 */
export async function saveCache(paths: string[], key: string): Promise<number> {
    checkPaths(paths);
    checkKey(key);

    console.log(JSON.stringify({ key, paths, env: process.env }, null, 2));

    const cacheDir = join(`/media/cache/`, process.env.GITHUB_REPOSITORY || "");
    const cacheName = `${filenamify(key)}.tar.lz4`;
    const cachePath = join(cacheDir, cacheName);

    const cmd = `mkdir -p ${cacheDir} && tar cf - ${paths.join(
        " "
    )} | lz4 -v > ${cachePath}`;

    console.log({ cacheDir, cacheName, cachePath, cmd });

    const createCacheDirPromise = execAsync(cmd);

    await streamOutputUntilResolved(createCacheDirPromise);

    return 420;
}
