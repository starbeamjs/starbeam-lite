import { CachedFormula, Cell, Formula } from "@starbeam-lite/core";
import { subscribe } from "@starbeam-lite/core/subtle";
import { TAG } from "@starbeam-lite/shared";
import { EventRecorder, TestScheduler } from "@workspace/test-utils";
import { describe, expect, it } from "vitest";

describe("subscribe", () => {
  describe("equivalent to Signal.subtle.Watcher (ported tests)", () => {
    it("should work", () => {
      const events = new EventRecorder();
      const scheduler = new TestScheduler();

      const cell = Cell.create(1);
      cell.set(100);
      cell.set(5);

      const formula = Formula.create(() => cell.read() * 2);

      // This represents an external stateful sink that is outside of the
      // reactivity system.
      const sink = {
        cell: null as number | null,
        formula: null as number | null,
      };

      const sync = SyncOut(() => {
        sink.cell = cell.read();
        sink.formula = formula.read();
        events.record("SyncOut");
      });

      // Schedule the initial sync to happen on the next flush. In a real-world
      // integration, this would be used to schedule the flush to happen in a
      // framework-appropriate timing (something like `useEffect` or
      // `onMounted`).
      scheduler.schedule(sync.read);

      // Since the scheduler has not flushed yet, there should be no recorded
      // events yet.
      events.expect([]);

      // Flush the schedule. This is a stand-in for a framework's internal
      // scheduling of after mount callbacks.
      scheduler.flush();
      events.expect("SyncOut");
      // The sink has not yet been updated.
      expect(sink).toEqual({
        cell: 5,
        formula: 10,
      });

      const unsubscribe = subscribe(sync[TAG], () => {
        events.record("ready");

        // Use the test scheduler to accumulate `sync.read()` as a pending
        // event. In a real-world integration, this would be used to schedule
        // the flush to happen in a framework-appropriate timing (something like
        // `useEffect` or `onBeforeUpdate`).
        scheduler.schedule(sync.read);
      });

      events.expect([]);

      // Updating the cell should trigger the `ready` event, which will schedule
      // the sync, but not yet run it.
      cell.set(10);
      events.expect("ready");
      // but the *formula* is always up to date
      expect(formula.read()).toBe(20);
      expect(sink).toEqual({
        cell: 5,
        formula: 10,
      });

      // Flush the scheduler. This will run the sync and update the sink.
      scheduler.flush();
      events.expect("SyncOut");
      //  the *formula* is still up to date
      expect(formula.read()).toBe(20);
      expect(sink).toEqual({
        cell: 10,
        formula: 20,
      });

      cell.set(20);
      events.expect("ready");
      // the *formula* is always up to date
      expect(formula.read()).toBe(40);
      expect(sink).toEqual({
        cell: 10,
        formula: 20,
      });
    });
  });
});

function SyncOut(flush: () => void): CachedFormula<void> {
  return CachedFormula.create(() => {
    // in principle, this should have a write barrier
    flush();
  });
}
