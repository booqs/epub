import { type } from "os"

export type Validator = | StringValidator | AnyStringValidator | NumberValidator
    | AnyValidator
    | ArrayValidator | ObjectValidator
    | OptionalValidator | UnionValidator
    | CustomValidator<unknown>
export type StringValidator = string & { type?: undefined }
export type NumberValidator = {
    type: 'number',
    min?: number,
    max?: number,
}
export type AnyStringValidator = {
    type: 'string',
}
export type AnyValidator = {
    type: 'any',
}
export type ArrayValidator = {
    type: 'array',
    items: Validator,
    minLength?: number,
    maxLength?: number,
}
export type ObjectValidator = {
    type: 'object',
    properties: {
        [key in string]: Validator
    },
    extraKey?: (key: string, value: unknown) => boolean,
}
export type OptionalValidator = {
    type: 'optional',
    validator: Validator,
}
export type UnionValidator = {
    type: 'union',
    validators: Validator[],
}
export type CustomValidator<T> = {
    type: 'custom',
    validate: (value: unknown) => ValidationError[],
    message?: string,
}

export type ValidatorType<T extends Validator> = T extends StringValidator ? StringValidatorType<T>
    : T extends AnyStringValidator ? AnyStringValidatorType<T>
    : T extends NumberValidator ? NumberValidatorType<T>
    : T extends AnyValidator ? AnyValidatorType<T>
    : T extends ArrayValidator ? ArrayValidatorType<T>
    : T extends ObjectValidator ? ObjectValidatorType<T>
    : T extends OptionalValidator ? OptionalValidatorType<T>
    : T extends UnionValidator ? UnionValidatorType<T>
    : T extends CustomValidator<unknown> ? CustomValidatorType<T>
    : unknown;

type StringValidatorType<T extends StringValidator> = T
type AnyStringValidatorType<T extends AnyStringValidator> = string
type NumberValidatorType<T extends NumberValidator> = number
type AnyValidatorType<T extends AnyValidator> = any
type ArrayValidatorType<T extends ArrayValidator> = Array<ValidatorType<T['items']>>
type ObjectValidatorType<T extends ObjectValidator> = {
    [P in keyof T['properties']]: ValidatorType<T['properties'][P]>;
}
type OptionalValidatorType<T extends OptionalValidator> = ValidatorType<T['validator']> | undefined
type UnionValidatorType<T extends UnionValidator> = ValidatorType<T['validators'][number]>
type CustomValidatorType<T extends CustomValidator<unknown>> = T extends CustomValidator<infer U> ? U : never

export function string(): AnyStringValidator {
    return {
        type: 'string',
    }
}

export function number(min?: number, max?: number): NumberValidator {
    return {
        type: 'number',
        min,
        max,
    }
}

export function any(): AnyValidator {
    return {
        type: 'any',
    }
}

export function array(items: Validator, minLength?: number, maxLength?: number): ArrayValidator {
    return {
        type: 'array',
        items,
        minLength, maxLength,
    }
}

export function object(properties: ObjectValidator['properties'], extraKey?: ObjectValidator['extraKey']): ObjectValidator {
    return {
        type: 'object',
        properties,
        extraKey,
    }
}

export function optional(validator: Validator): OptionalValidator {
    return {
        type: 'optional',
        validator,
    }
}

export function oneOf(...validators: Validator[]): UnionValidator {
    return {
        type: 'union',
        validators,
    }
}

export function custom<T>(validate: (value: unknown) => ValidationError[]): CustomValidator<T> {
    return {
        type: 'custom',
        validate,
    }
}

export type ValidationError = string

export function validateObject<T extends Validator>(object: unknown, validator: T): ValidationError[] {
    if (typeof validator === 'string') {
        if (object === validator) {
            return []
        } else {
            return [`expected ${validator} but got ${object}`]
        }
    }
    switch (validator.type) {
        case 'string': {
            if (typeof object === 'string') {
                return []
            } else {
                return [`expected any string but got ${object}`]
            }
        }
        case 'any':
            return []
        case 'number': {
            if (typeof object === 'number') {
                if (validator.min !== undefined && object < validator.min) {
                    return [`expected number >= ${validator.min} but got ${object}`]
                } else if (validator.max !== undefined && object > validator.max) {
                    return [`expected number <= ${validator.max} but got ${object}`]
                } else {
                    return []
                }
            } else {
                return [`expected number but got ${object}`]
            }
        }
        case 'array': {
            if (!Array.isArray(object)) {
                return [`expected array but got ${object}`]
            } else if (validator.minLength !== undefined && object.length < validator.minLength) {
                return [`expected array with length >= ${validator.minLength} but got ${object.length}`]
            } else if (validator.maxLength !== undefined && object.length > validator.maxLength) {
                return [`expected array with length <= ${validator.maxLength} but got ${object.length}`]
            } else {
                let inner = object
                    .map(item => validateObject(item, validator.items))
                    .flat()
                return inner
            }
        }
        case 'object': {
            if (typeof object !== 'object') {
                return [`expected object but got ${object}`]
            } else if (object === null) {
                return [`expected object but got null`]
            } else if (Array.isArray(object)) {
                return [`expected object but got array`]
            } else {
                let result: ValidationError[] = []
                let validatorKeys = new Set(Object.keys(validator.properties))
                for (let [key, value] of Object.entries(object)) {
                    let v = validator.properties[key]
                    if (v === undefined) {
                        if (validator.extraKey === undefined || !validator.extraKey(key, value)) {
                            result.push(`unexpected key ${key}`)
                        }
                    } else {
                        validatorKeys.delete(key)
                        let current = validateObject(value, v)
                        result.push(...current.map(m => `${key}: ${m}`))
                    }
                }
                result.push(...Array.from(validatorKeys)
                    .filter(
                        k => validator.properties[k].type !== 'optional')
                    .map(k => `missing key ${k}`))
                return result
            }
        }
        case 'optional': {
            if (object === undefined) {
                return []
            } else {
                return validateObject(object, validator.validator)
            }
        }
        case 'union': {
            let result: ValidationError[] = []
            for (let v of validator.validators) {
                let current = validateObject(object, v)
                if (current.length === 0) {
                    return []
                }
                result.push(...current)
            }
            return [`expected one of ${validator.validators.map(toString).join(', ')} but got '${object}'`]
        }
        case 'custom': {
            return validator.validate(object)
                .map(m => `${validator.message ?? 'custom'}: ${m}`)
        }
        default:
            return assertNever(validator)
    }
}

export function toString(validator: Validator): string {
    switch (validator.type) {
        case undefined:
            return validator
        case 'string':
        case 'any':
        case 'number':
            return validator.type
        case 'array':
            return `array of ${toString(validator.items)}`
        case 'object':
            return `object { ${Object.entries(validator.properties).map(([key, value]) => `${key}: ${toString(value)}`).join(', ')} }`
        case 'optional':
            return `optional ${toString(validator.validator)}`
        case 'union':
            return `one of ${validator.validators.map(toString).join(', ')}`
        case 'custom':
            return `custom: ${validator.message ?? ''}`
        default:
            return assertNever(validator)

    }
}

function assertNever(x: never): never {
    throw new Error(`Unexpected object: ${x}`)
}