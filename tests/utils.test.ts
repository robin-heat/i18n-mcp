import { describe, expect, it } from 'vitest';
import { deleteNestedKey, flattenKeys, setNestedValue } from '../src/utils.js';

describe('flattenKeys', () => {
  it('flattens nested object to dotted paths', () => {
    expect(flattenKeys({ button: { save: 'Save', cancel: 'Cancel' } }))
      .toEqual({ 'button.save': 'Save', 'button.cancel': 'Cancel' });
  });

  it('handles flat objects unchanged', () => {
    expect(flattenKeys({ hello: 'world' })).toEqual({ hello: 'world' });
  });

  it('handles deeply nested objects', () => {
    expect(flattenKeys({ a: { b: { c: 'deep' } } })).toEqual({ 'a.b.c': 'deep' });
  });

  it('returns empty object for empty input', () => {
    expect(flattenKeys({})).toEqual({});
  });
});

describe('setNestedValue', () => {
  it('sets a top-level key on empty object', () => {
    expect(setNestedValue({}, 'hello', 'world')).toEqual({ hello: 'world' });
  });

  it('sets a nested key creating intermediate objects', () => {
    expect(setNestedValue({}, 'button.save', 'Save')).toEqual({ button: { save: 'Save' } });
  });

  it('merges with sibling keys at same level', () => {
    const obj = { button: { cancel: 'Cancel' } };
    expect(setNestedValue(obj, 'button.save', 'Save'))
      .toEqual({ button: { cancel: 'Cancel', save: 'Save' } });
  });

  it('does not mutate the original object', () => {
    const obj = { button: { save: 'Old' } };
    setNestedValue(obj, 'button.save', 'New');
    expect(obj.button.save).toBe('Old');
  });

  it('throws when intermediate path segment is a scalar', () => {
    expect(() => setNestedValue({ button: 'Save' }, 'button.cancel', 'Cancel'))
      .toThrow("Cannot set 'button.cancel': 'button' is not a plain object");
  });

  it('throws when intermediate path segment is an array', () => {
    expect(() => setNestedValue({ items: ['a', 'b'] }, 'items.first', 'A'))
      .toThrow("Cannot set 'items.first': 'items' is not a plain object");
  });
});

describe('deleteNestedKey', () => {
  it('deletes a top-level key', () => {
    expect(deleteNestedKey({ hello: 'world', bye: 'earth' }, 'hello'))
      .toEqual({ bye: 'earth' });
  });

  it('deletes a nested key leaving siblings intact', () => {
    expect(deleteNestedKey({ button: { save: 'Save', cancel: 'Cancel' } }, 'button.save'))
      .toEqual({ button: { cancel: 'Cancel' } });
  });

  it('returns unchanged object if key does not exist', () => {
    const obj = { hello: 'world' };
    expect(deleteNestedKey(obj, 'nonexistent')).toEqual({ hello: 'world' });
  });

  it('does not mutate the original object', () => {
    const obj = { button: { save: 'Save' } };
    deleteNestedKey(obj, 'button.save');
    expect(obj.button.save).toBe('Save');
  });

  it('returns unchanged object when intermediate segment is an array', () => {
    const obj = { items: ['a', 'b'], other: 'value' };
    expect(deleteNestedKey(obj, 'items.first')).toEqual(obj);
  });
});
