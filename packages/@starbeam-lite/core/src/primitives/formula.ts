import { TAG } from "@starbeam-lite/shared";

import type { MutableTag } from "./cell.js";
import { initialized, start, updated } from "./runtime.js";
import type { Subscription } from "./subscriptions.js";
import type { Tagged, TagSnapshot } from "./tag.js";

/**
 * A formula tag represents the validation state of a formula.
 */
export class FormulaTag {
  readonly type = "formula";

  #initialized = false;
  #dependencies: TagSnapshot = [];

  /**
   * If there are any subscribers to the formula, the `subscription` field holds
   * a reference to the {@linkcode Subscription} that tracks the subscribers and
   * their ready callbacks.
   */
  subscription: Subscription | undefined;

  /**
   * This method is called after the concrete formula has been computed with
   * an updated list of its direct dependencies. Direct dependencies can be
   * other {@linkcode FormulaTag}s or {@linkcode MutableTag}s.
   */
  updated(tags: TagSnapshot): void {
    this.#dependencies = tags;

    if (this.#initialized) {
      updated(this);
    } else {
      this.#initialized = true;
      initialized(this);
    }
  }

  /**
   * The `dependencies` property returns a list of the leaf dependencies of the
   * formula.
   *
   * Leaf dependencies are {@linkcode MutableTags}s. Notably, a frozen
   * {@linkcode MutableTag} is not considered a dependency, since it cannot
   * change and therefore does not need to be accounted for in the validation
   * algorithm.
   *
   * The purpose of this property is to allow for efficient validation of
   * formula dependencies, since the last updated value of a flat array of
   * {@linkcode MutableTag}s is simply:
   *
   * ```js
   * Math.max(...dependencies.map(d => d.lastUpdated))
   * ```
   *
   * And determining whether any of the dependencies have been updated is
   * a simple comparison:
   *
   * ```js
   * dependencies.some(d => d.lastUpdated > lastUpdated)
   * ```
   */
  get dependencies(): TagSnapshot<MutableTag> {
    return [...this.#dependencies].flatMap((tag) => {
      switch (tag.type) {
        case "formula":
          return tag.dependencies ?? [];
        case "mutable":
          return tag.dependency ? [tag.dependency] : [];
      }
    });
  }
}

export class Formula<T> implements Tagged<T> {
  static create<T>(compute: () => T): Formula<T> {
    return new Formula(compute);
  }

  [TAG]: FormulaTag = new FormulaTag();
  readonly #compute: () => T;

  private constructor(compute: () => T) {
    this.#compute = compute;
  }

  read(): T {
    const tag = this[TAG];

    const [value, tags] = evaluate(this.#compute);

    tag.updated(tags);
    return value;
  }
}

function evaluate<T>(compute: () => T): [value: T, tags: TagSnapshot] {
  const done = start();
  const value = compute();
  const tags = done();
  return [value, [...tags]];
}
