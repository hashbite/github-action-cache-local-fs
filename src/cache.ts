import { exec, PromiseWithChild } from "child_process";
import { readdir } from "fs";
import { join } from "path";
import { promisify } from "util";

import { DownloadOptions, UploadOptions } from "./options";

const execAsync = promisify(exec);
const readDirAsync = promisify(readdir);

export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ValidationError";
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}

export class ReserveCacheError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ReserveCacheError";
        Object.setPrototypeOf(this, ReserveCacheError.prototype);
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
    if (key.length > 512) {
        throw new ValidationError(
            `Key Validation Error: ${key} cannot be larger than 512 characters.`
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
            console.error(`Received error chunk ${data}`);
        });
    }

    return promise;
}

/**
 * Restores cache from keys
 *
 * @param paths a list of file paths to restore from the cache
 * @param primaryKey an explicit key for restoring the cache
 * @param restoreKeys an optional ordered list of keys to use for restoring the cache if no cache hit occurred for key
 * @param downloadOptions cache download options
 * @returns string returns the key for the cache hit, otherwise returns undefined
 */
export async function restoreCache(
    paths: string[],
    primaryKey: string,
    restoreKeys?: string[],
    options?: DownloadOptions
): Promise<string | undefined> {
    console.log(JSON.stringify({ paths, primaryKey, restoreKeys, options }));

    const cacheDir = join(`/media/cache/`, process.env.GITHUB_REPOSITORY || "");

    // 1. check if we find any dir that matches our keys from restoreKeys

    const mkdirPromise = execAsync(`mkdir -p ${cacheDir}`);

    await streamOutputUntilResolved(mkdirPromise);

    const cacheDirs = await readDirAsync(cacheDir);

    console.log({ cacheDirs });

    let foundKey;
    let foundDir;
    for (const restoreKey of restoreKeys || [primaryKey]) {
        for (const dir of cacheDirs) {
            if (dir.indexOf(restoreKey) !== -1) {
                foundDir = dir;
                foundKey = restoreKey;
            }
        }
    }

    console.log({ foundKey, foundDir });

    if (!foundKey) {
        return undefined;
    }

    // 2. if we found one, rsync it back to the HD
    const createCacheDirPromise = execAsync(
        `rsync -ahm --delete --force --stats ${join(
            cacheDir,
            foundDir,
            paths[0]
        )} ${paths[0]}`
    );

    await streamOutputUntilResolved(createCacheDirPromise);
}

/**
 * Saves a list of files with the specified key
 *
 * @param paths a list of file paths to be cached
 * @param key an explicit key for restoring the cache
 * @param options cache upload options
 * @returns number returns cacheId if the cache was saved successfully and throws an error if save fails
 */
export async function saveCache(
    paths: string[],
    key: string,
    options?: UploadOptions
): Promise<number> {
    console.log(
        JSON.stringify({ env: process.env, paths, key, options }, null, 2)
    );

    const cacheDir = join(
        `/media/cache/`,
        process.env.GITHUB_REPOSITORY || "",
        key
    );

    const createCacheDirPromise = execAsync(
        `mkdir -p ${cacheDir} && rsync -ahm --delete --force --stats ${paths[0]} ${cacheDir}`
    );

    await streamOutputUntilResolved(createCacheDirPromise);

    return 420;
}
