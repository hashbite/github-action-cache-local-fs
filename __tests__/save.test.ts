import * as core from "@actions/core";

import * as cache from "../src/cache";
import { Events, Inputs, RefKey } from "../src/constants";
import run from "../src/save";
import * as actionUtils from "../src/utils/actionUtils";
import * as testUtils from "../src/utils/testUtils";

jest.mock("@actions/core");
jest.mock("../src/cache");
jest.mock("../src/utils/actionUtils");

beforeAll(() => {
    jest.spyOn(core, "getInput").mockImplementation((name, options) => {
        return jest.requireActual("@actions/core").getInput(name, options);
    });

    jest.spyOn(actionUtils, "getCacheState").mockImplementation(() => {
        return jest.requireActual("../src/utils/actionUtils").getCacheState();
    });

    jest.spyOn(actionUtils, "getInputAsArray").mockImplementation(
        (name, options) => {
            return jest
                .requireActual("../src/utils/actionUtils")
                .getInputAsArray(name, options);
        }
    );

    jest.spyOn(actionUtils, "getInputAsInt").mockImplementation(
        (name, options) => {
            return jest
                .requireActual("../src/utils/actionUtils")
                .getInputAsInt(name, options);
        }
    );

    jest.spyOn(actionUtils, "isExactKeyMatch").mockImplementation(
        (key, cacheResult) => {
            return jest
                .requireActual("../src/utils/actionUtils")
                .isExactKeyMatch(key, cacheResult);
        }
    );

    jest.spyOn(actionUtils, "isValidEvent").mockImplementation(() => {
        const actualUtils = jest.requireActual("../src/utils/actionUtils");
        return actualUtils.isValidEvent();
    });
});

beforeEach(() => {
    process.env[Events.Key] = Events.Push;
    process.env[RefKey] = "refs/heads/feature-branch";

    jest.spyOn(actionUtils, "isGhes").mockImplementation(() => false);
});

afterEach(() => {
    testUtils.clearInputs();
    delete process.env[Events.Key];
    delete process.env[RefKey];
});

test("save with invalid event outputs warning", async () => {
    const logWarningMock = jest.spyOn(actionUtils, "logWarning");
    const failedMock = jest.spyOn(core, "setFailed");
    const invalidEvent = "commit_comment";
    process.env[Events.Key] = invalidEvent;
    delete process.env[RefKey];
    await run();
    expect(logWarningMock).toHaveBeenCalledWith(
        `Event Validation Error: The event type ${invalidEvent} is not supported because it's not tied to a branch or tag ref.`
    );
    expect(failedMock).toHaveBeenCalledTimes(0);
});

test("save with no primary key in state outputs warning", async () => {
    const logWarningMock = jest.spyOn(actionUtils, "logWarning");
    const failedMock = jest.spyOn(core, "setFailed");

    const savedCacheKey = "Linux-node-bb828da54c148048dd17899ba9fda624811cfb43";
    jest.spyOn(core, "getState")
        // Cache Entry State
        .mockImplementationOnce(() => {
            return savedCacheKey;
        })
        // Cache Key State
        .mockImplementationOnce(() => {
            return "";
        });
    const saveCacheMock = jest.spyOn(cache, "saveCache");

    await run();

    expect(saveCacheMock).toHaveBeenCalledTimes(0);
    expect(logWarningMock).toHaveBeenCalledWith(
        `Error retrieving key from state.`
    );
    expect(logWarningMock).toHaveBeenCalledTimes(1);
    expect(failedMock).toHaveBeenCalledTimes(0);
});

test("save on GHES should no-op", async () => {
    jest.spyOn(actionUtils, "isGhes").mockImplementation(() => true);

    const logWarningMock = jest.spyOn(actionUtils, "logWarning");
    const saveCacheMock = jest.spyOn(cache, "saveCache");

    await run();

    expect(saveCacheMock).toHaveBeenCalledTimes(0);
    expect(logWarningMock).toHaveBeenCalledWith(
        "Cache action is not supported on GHES"
    );
});

test("save with exact match returns early", async () => {
    const infoMock = jest.spyOn(core, "info");
    const failedMock = jest.spyOn(core, "setFailed");

    const primaryKey = "Linux-node-bb828da54c148048dd17899ba9fda624811cfb43";
    const savedCacheKey = primaryKey;

    jest.spyOn(core, "getState")
        // Cache Entry State
        .mockImplementationOnce(() => {
            return savedCacheKey;
        })
        // Cache Key State
        .mockImplementationOnce(() => {
            return primaryKey;
        });
    const saveCacheMock = jest.spyOn(cache, "saveCache");

    await run();

    expect(saveCacheMock).toHaveBeenCalledTimes(0);
    expect(infoMock).toHaveBeenCalledWith(
        `Cache hit occurred on the primary key ${primaryKey}, not saving cache.`
    );
    expect(failedMock).toHaveBeenCalledTimes(0);
});

test("save with missing input outputs warning", async () => {
    const logWarningMock = jest.spyOn(actionUtils, "logWarning");
    const failedMock = jest.spyOn(core, "setFailed");

    const primaryKey = "Linux-node-bb828da54c148048dd17899ba9fda624811cfb43";
    const savedCacheKey = "Linux-node-";

    jest.spyOn(core, "getState")
        // Cache Entry State
        .mockImplementationOnce(() => {
            return savedCacheKey;
        })
        // Cache Key State
        .mockImplementationOnce(() => {
            return primaryKey;
        });
    const saveCacheMock = jest.spyOn(cache, "saveCache");

    await run();

    expect(saveCacheMock).toHaveBeenCalledTimes(0);
    expect(logWarningMock).toHaveBeenCalledWith(
        "Input required and not supplied: path"
    );
    expect(logWarningMock).toHaveBeenCalledTimes(1);
    expect(failedMock).toHaveBeenCalledTimes(0);
});

test("save with reserve cache failure outputs warning", async () => {
    const infoMock = jest.spyOn(core, "info");
    const logWarningMock = jest.spyOn(actionUtils, "logWarning");
    const failedMock = jest.spyOn(core, "setFailed");

    const primaryKey = "Linux-node-bb828da54c148048dd17899ba9fda624811cfb43";
    const savedCacheKey = "Linux-node-";

    jest.spyOn(core, "getState")
        // Cache Entry State
        .mockImplementationOnce(() => {
            return savedCacheKey;
        })
        // Cache Key State
        .mockImplementationOnce(() => {
            return primaryKey;
        });

    const inputPath = "node_modules";
    testUtils.setInput(Inputs.Path, inputPath);

    const saveCacheMock = jest
        .spyOn(cache, "saveCache")
        .mockImplementationOnce(() => {
            const actualCache = jest.requireActual("@actions/cache");
            const error = new actualCache.ReserveCacheError(
                `Unable to reserve cache with key ${primaryKey}, another job may be creating this cache.`
            );
            throw error;
        });

    await run();

    expect(saveCacheMock).toHaveBeenCalledTimes(1);
    expect(saveCacheMock).toHaveBeenCalledWith([inputPath], primaryKey);

    expect(infoMock).toHaveBeenCalledWith(
        `Unable to reserve cache with key ${primaryKey}, another job may be creating this cache.`
    );
    expect(logWarningMock).toHaveBeenCalledTimes(0);
    expect(failedMock).toHaveBeenCalledTimes(0);
});

test("save with server error outputs warning", async () => {
    const logWarningMock = jest.spyOn(actionUtils, "logWarning");
    const failedMock = jest.spyOn(core, "setFailed");

    const primaryKey = "Linux-node-bb828da54c148048dd17899ba9fda624811cfb43";
    const savedCacheKey = "Linux-node-";

    jest.spyOn(core, "getState")
        // Cache Entry State
        .mockImplementationOnce(() => {
            return savedCacheKey;
        })
        // Cache Key State
        .mockImplementationOnce(() => {
            return primaryKey;
        });

    const inputPath = "node_modules";
    testUtils.setInput(Inputs.Path, inputPath);

    const saveCacheMock = jest
        .spyOn(cache, "saveCache")
        .mockImplementationOnce(() => {
            throw new Error("HTTP Error Occurred");
        });

    await run();

    expect(saveCacheMock).toHaveBeenCalledTimes(1);
    expect(saveCacheMock).toHaveBeenCalledWith([inputPath], primaryKey);

    expect(logWarningMock).toHaveBeenCalledTimes(1);
    expect(logWarningMock).toHaveBeenCalledWith("HTTP Error Occurred");

    expect(failedMock).toHaveBeenCalledTimes(0);
});

test("save with valid inputs uploads a cache", async () => {
    const failedMock = jest.spyOn(core, "setFailed");

    const primaryKey = "Linux-node-bb828da54c148048dd17899ba9fda624811cfb43";
    const savedCacheKey = "Linux-node-";

    jest.spyOn(core, "getState")
        // Cache Entry State
        .mockImplementationOnce(() => {
            return savedCacheKey;
        })
        // Cache Key State
        .mockImplementationOnce(() => {
            return primaryKey;
        });

    const inputPath = "node_modules";
    testUtils.setInput(Inputs.Path, inputPath);

    const cacheId = 4;
    const saveCacheMock = jest
        .spyOn(cache, "saveCache")
        .mockImplementationOnce(() => {
            return Promise.resolve(cacheId);
        });

    await run();

    expect(saveCacheMock).toHaveBeenCalledTimes(1);
    expect(saveCacheMock).toHaveBeenCalledWith([inputPath], primaryKey);

    expect(failedMock).toHaveBeenCalledTimes(0);
});
