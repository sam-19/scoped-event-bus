/**
 * Utility functions.
 * @package    scoped-event-bus
 * @copyright  2024 Sampsa Lohi
 * @license    MIT
 */

/**
 * Get the value stored at the given `key` in the target Map.
 * If the key does not exist, it will be initiated with the given `value`
 * and a reference to the set value is returned.
 * @param map - The target Map.
 * @param key - Key to look for.
 * @param value - Default value to use as initiator, if the `key` doesn't exist.
 * @returns Value stored at the given key.
 */
export const getOrSetValue = <T>(
    map: Map<typeof key, typeof value>,
    key: string|number,
    value: T
): T => {
    return map.has(key) ? map.get(key) as T : map.set(key, value).get(key) as T
}