"use strict";
/**
 * Helper class to create and set states
 */
export class StateHelper {
    /**
     * Create and set a state
     *
     * @param adapter The adapter
     * @param stateID The ID of the state
     * @param common The common object
     * @param native The native object
     * @param value The value to set
     * @returns Returns a Promise<void>
     */
    static async createAndSetStateAsync(adapter, stateID, common, native, value) {
        await adapter.extendObject(stateID, {
            type: "state",
            common: common,
            native: native,
        });
        await adapter.setState(stateID, value, true);
    }
}
//# sourceMappingURL=stateHelper.js.map