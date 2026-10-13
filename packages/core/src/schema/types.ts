export type Primitive = string | number | boolean | null;

export type FormValues = Record<string, unknown>;

export type FieldType =
  | 'text'
  | 'email'
  | 'url'
  | 'tel'
  | 'number'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'checkbox-group'
  | 'date'
  | 'custom';

export type FieldOption = {
  value: string;
  label: string;
};

/** A single condition on another field's value. Every operator present must hold. */
export type FieldCondition = {
  field: string;
  equals?: Primitive;
  notEquals?: Primitive;
  in?: Primitive[];
  notIn?: Primitive[];
  /** Array (checkbox group) includes the value, or string contains the substring. */
  contains?: Primitive;
  filled?: boolean;
  empty?: boolean;
  gt?: number;
  gte?: number;
  lt?: number;
  lte?: number;
};

export type Condition =
  | FieldCondition
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition };

/** Constraints shared by the DSL props and the serialized schema. */
export type FieldConstraints = {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  /** Matched against the whole value, like the HTML `pattern` attribute. */
  pattern?: string;
  patternMessage?: string;
  /** Number fields: numeric bounds. Date fields: `YYYY-MM-DD` bounds. */
  min?: number | string;
  max?: number | string;
  integer?: boolean;
  /** Number fields: answers are `min` (or 0) plus a whole number of steps. */
  step?: number;
  minSelected?: number;
  maxSelected?: number;
};

export type FieldSchema = FieldConstraints & {
  name: string;
  type: FieldType;
  label?: string;
  description?: string;
  options?: FieldOption[];
  /** Index of the step (`<Page>`) the field lives on. */
  page: number;
  /** Every condition must hold for the field to be visible. Empty means always visible. */
  when: Condition[];
  hasCustomValidator?: boolean;
};

export type PageSchema = {
  index: number;
  title?: string;
  when: Condition[];
};

export type FormSchema = {
  id: string;
  title?: string;
  description?: string;
  pages: PageSchema[];
  fields: FieldSchema[];
};

export type FieldErrors = Record<string, string>;
