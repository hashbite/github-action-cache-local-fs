# custom cache action using local file system

<a href="https://github.com/hashbite/github-action-cache-local-fs/actions?query=workflow%3ATests"><img alt="GitHub Actions status" src="https://github.com/hashbite/github-action-cache-local-fs/workflows/Tests/badge.svg?branch=main&event=push"></a>

> This modified version can speed up builds significantly as you don't have to rely on a network cache anymore.

**IMPORTANT**: This will only work when you [host your GitHub Runner on your own](https://docs.github.com/en/actions/hosting-your-own-runners/about-self-hosted-runners)!

## Further benefits compared to using the default network driven github cache action:

* No 5GB cache size limit. Your own hardware sets the boundaries.
* Use as many keys as you like (instead of max 10 keys)
* Keys can be as long till your file system has issue with your file name (instead of 512 characters max)
* Instead of zipping and uploading, we will do zipping and moving. Much faster as some network connections if you are on SSD/RAID.
* Your projects build data actually stays on your own hardware.
* We can add more feature to customize behavior. Lets chat in the issues.
* ... potentially more which I overlook at this very moment ...

## Documentation

See ["Caching dependencies to speed up workflows"](https://help.github.com/github/automating-your-workflow-with-github-actions/caching-dependencies-to-speed-up-workflows).

## Usage

Pretty similar to the original cache plugin. You likely can copy & paste your configuration.

### Pre-requisites
Create a workflow `.yml` file in your repositories `.github/workflows` directory. An [example workflow](#example-workflow) is available below. For more information, reference the GitHub Help Documentation for [Creating a workflow file](https://help.github.com/en/articles/configuring-a-workflow#creating-a-workflow-file).

### Inputs

* `path` - A list of files, directories, and wildcard patterns to cache and restore. See [`@actions/glob`](https://github.com/actions/toolkit/tree/main/packages/glob) for supported patterns.
* `key` - An explicit key for restoring and saving the cache
* `restore-keys` - An ordered list of keys to use for restoring the cache if no cache hit occurred for key

### Outputs

* `cache-hit` - A boolean value to indicate an exact match was found for the key

> See [Skipping steps based on cache-hit](#Skipping-steps-based-on-cache-hit) for info on using this output

### Cache scopes
The cache is scoped to the key and branch. The default branch cache is available to other branches.

See [Matching a cache key](https://help.github.com/en/actions/configuring-and-managing-workflows/caching-dependencies-to-speed-up-workflows#matching-a-cache-key) for more info.

### Example workflow

```yaml
name: Caching Primes

on: push

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v2

    - name: Cache Primes
      id: cache-primes
      uses: hashbite/github-action-cache-local-fs@main
      with:
        path: prime-numbers
        key: ${{ runner.os }}-primes

    - name: Generate Prime Numbers
      if: steps.cache-primes.outputs.cache-hit != 'true'
      run: /generate-primes.sh -d prime-numbers

    - name: Use Prime Numbers
      run: /primes.sh -d prime-numbers
```

## Implementation Examples

Every programming language and framework has its own way of caching.
## Creating a cache key

A cache key can include any of the contexts, functions, literals, and operators supported by GitHub Actions.

For example, using the [`hashFiles`](https://help.github.com/en/actions/reference/context-and-expression-syntax-for-github-actions#hashfiles) function allows you to create a new cache when dependencies change.

```yaml
  - uses: hashbite/github-action-cache-local-fs@main
    with:
      path: |
        path/to/dependencies
        some/other/dependencies
      key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}
```

Additionally, you can use arbitrary command output in a cache key, such as a date or software version:

```yaml
  # http://man7.org/linux/man-pages/man1/date.1.html
  - name: Get Date
    id: get-date
    run: |
      echo "::set-output name=date::$(/bin/date -u "+%Y%m%d")"
    shell: bash

  - uses: hashbite/github-action-cache-local-fs@main
    with:
      path: path/to/dependencies
      key: ${{ runner.os }}-${{ steps.get-date.outputs.date }}-${{ hashFiles('**/lockfiles') }}
```

See [Using contexts to create cache keys](https://help.github.com/en/actions/configuring-and-managing-workflows/caching-dependencies-to-speed-up-workflows#using-contexts-to-create-cache-keys)

## Skipping steps based on cache-hit

Using the `cache-hit` output, subsequent steps (such as install or build) can be skipped when a cache hit occurs on the key.

Example:
```yaml
steps:
  - uses: actions/checkout@v2

  - uses: hashbite/github-action-cache-local-fs@main
    id: cache
    with:
      path: path/to/dependencies
      key: ${{ runner.os }}-${{ hashFiles('**/lockfiles') }}

  - name: Install Dependencies
    if: steps.cache.outputs.cache-hit != 'true'
    run: /install.sh
```

> Note: The `id` defined in `hashbite/github-action-cache-local-fs` must match the `id` in the `if` statement (i.e. `steps.[ID].outputs.cache-hit`)

## Contributing
We would love for you to contribute to `hashbite/github-action-cache-local-fs`, pull requests are welcome! Please see the [CONTRIBUTING.md](CONTRIBUTING.md) for more information.

## License
The scripts and documentation in this project are released under the [MIT License](LICENSE)
