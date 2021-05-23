import { exec } from "child_process";

import { DownloadOptions, UploadOptions } from "./options";

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
    return Promise.resolve("wohow");
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
    console.log(JSON.stringify(process.env, null, 2));

    return new Promise((resolve, reject) => {
        // run: '[ -d "/media/cache/${{ github.repository }}/${{ github.ref }}/public/" ] && rsync -ahm --delete --force --stats /media/cache/${{ github.repository }}/${{ github.ref }}/public/ ./public || echo "cache does not exist yet"'
        // run: mkdir -p /media/cache/${{ github.repository }}/${{ github.ref }}/public && rsync -ahm --delete --force --stats ./public /media/cache/${{ github.repository }}/${{ github.ref }}/public

        const { stdout, stderr } = exec(
            "cat *.js missing_file | wc -l",
            (error, stdout, stderr) => {
                if (error) {
                    console.error(`exec error: ${error}`);
                    reject(error);
                    return;
                }
                console.log(`stdout: ${stdout}`);
                console.error(`stderr: ${stderr}`);
                resolve(420);
            }
        );

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
    });

    console.log(JSON.stringify({ paths, key, options }));
    return Promise.resolve(420);
}
