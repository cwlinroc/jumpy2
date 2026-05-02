export function getAllKeys(customKeys: ReadonlyArray<string>) {
    let lowerCharacters: Array<string> = [];
    let upperCharacters: Array<string> = [];

    if (!customKeys.length) {
        const aCode = 'a'.charCodeAt(0);
        const ACode = 'A'.charCodeAt(0);
        lowerCharacters = Array.from({ length: 26 }, (_, i) => String.fromCharCode(aCode + i));
        upperCharacters = Array.from({ length: 26 }, (_, i) => String.fromCharCode(ACode + i));
    } else {
        for (const key of customKeys) {
            lowerCharacters.push(key.toLowerCase());
            upperCharacters.push(key.toUpperCase());
        }
    }

    return {
        lowerCharacters: <ReadonlyArray<string>>lowerCharacters,
        upperCharacters: <ReadonlyArray<string>>upperCharacters,
    };
}

function _getKeySet(customKeys: ReadonlyArray<string>) {
    const { lowerCharacters, upperCharacters } = getAllKeys(customKeys);

    const keys: Array<string> = [];

    // A little ugly.
    // I used itertools.permutation in python.
    // Couldn't find a good one in npm.  Don't worry this takes < 1ms once.
    for (const c1 of lowerCharacters) {
        for (const c2 of lowerCharacters) {
            keys.push(c1 + c2);
        }
    }
    for (const c1 of upperCharacters) {
        for (const c2 of lowerCharacters) {
            keys.push(c1 + c2);
        }
    }
    for (const c1 of lowerCharacters) {
        for (const c2 of upperCharacters) {
            keys.push(c1 + c2);
        }
    }

    return <ReadonlyArray<string>>keys;
}

const _keySetCache = new Map<string, ReadonlyArray<string>>();
export function getKeySet(customKeys: ReadonlyArray<string>) {
    const cacheKey = JSON.stringify(customKeys);
    let cached = _keySetCache.get(cacheKey);
    if (cached === undefined) {
        cached = _getKeySet(customKeys);
        _keySetCache.set(cacheKey, cached);
    }
    return cached;
}
