"use strict";
import { PromiseQueue } from "./promiseQueue.js";
/**
 * Maps any property value to a string, number, boolean or null.
 *
 * Maps undefined to null, booleans to booleans, numbers to numbers, strings to strings.
 * If the value is an object, it will be converted to a string using its toString method.
 * If the value is null or undefined, it will be converted to null.
 *
 * @param propertyValue The value of the property to map.
 * @returns The mapped value.
 */
export function MapAnyPropertyToState(propertyValue) {
    if (propertyValue === undefined) {
        return null;
    }
    switch (typeof propertyValue) {
        case "boolean":
            return propertyValue;
        case "number":
            return propertyValue;
        case "string":
            return propertyValue;
        default:
            if (propertyValue) {
                return propertyValue.toString();
            }
    }
    return null;
}
/**
 * Handles property changed events for a specific property of a component.
 * This is an abstract base class.
 *
 * @template T The component type.
 * @template P The property key of the component.
 */
export class BasePropertyChangedHandler {
    Adapter;
    Property;
    LinkedObject;
    disposable;
    /**
     * Creates a new instance of BasePropertyChangedHandler.
     *
     * @param Adapter The ioBroker adapter instance.
     * @param Property The property key of the component.
     * @param LinkedObject The component instance.
     */
    constructor(Adapter, Property, LinkedObject) {
        this.Adapter = Adapter;
        this.Property = Property;
        this.LinkedObject = LinkedObject;
        this.disposable = LinkedObject.propertyChangedEvent.on(async (event) => {
            if (event.propertyName === this.Property) {
                await this.onPropertyChangedTypedEvent(event.propertyValue);
            }
        });
    }
    // eslint-disable-next-line jsdoc/require-returns-check
    /**
     * Called when the linked property changes.
     *
     * @param newValue The new value of the property.
     * @returns A promise that resolves when the event has been handled.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onPropertyChangedTypedEvent(newValue) {
        throw new Error("Method not implemented.");
    }
    /**
     * Disposes the handler and all its resources.
     *
     * This method is idempotent.
     */
    dispose() {
        this.disposable?.dispose();
    }
}
/**
 * Handles property changed events for a specific property of a component using a custom handler function.
 *
 * @template T The component type.
 * @template P The property key of the component.
 */
export class ComplexPropertyChangedHandler extends BasePropertyChangedHandler {
    Handler;
    /**
     * Creates a new instance of ComplexPropertyChangedHandler.
     *
     * @param Adapter The ioBroker adapter that should be used to register the event handler.
     * @param Property The property key of the component that should be observed.
     * @param LinkedObject The component that owns the property.
     * @param Handler The function that should be called when the property changes.
     */
    constructor(Adapter, Property, LinkedObject, Handler) {
        super(Adapter, Property, LinkedObject);
        this.Handler = Handler;
    }
    /**
     * Called when the linked property changes.
     *
     * @param newValue The new value of the property.
     * @returns A promise that resolves when the event has been handled.
     */
    async onPropertyChangedTypedEvent(newValue) {
        await this.Handler(newValue);
    }
    /**
     * Disposes the handler and all its resources.
     *
     * This method is idempotent.
     */
    dispose() {
        this.disposable?.dispose();
    }
}
/**
 * Handles property changed events for a specific property of a component and updates the corresponding ioBroker state.
 *
 * @template T The component type.
 * @template P The property key of the component.
 */
export class SimplePropertyChangedHandler extends BasePropertyChangedHandler {
    StateId;
    /**
     * Creates a new instance of SimplePropertyChangedHandler.
     *
     * @param Adapter The ioBroker adapter that should be used to register the event handler.
     * @param StateId The ID of the state that should be updated when the property changes.
     * @param Property The property key of the component that should be observed.
     * @param LinkedObject The component that owns the property.
     */
    constructor(Adapter, StateId, Property, LinkedObject) {
        super(Adapter, Property, LinkedObject);
        this.StateId = StateId;
    }
    /**
     * Handles the event when a property value changes and updates the corresponding ioBroker state.
     *
     * @param newValue The new value of the property.
     * @returns A promise that resolves when the state has been updated.
     */
    async onPropertyChangedTypedEvent(newValue) {
        await this.Adapter.setState(this.StateId, MapAnyPropertyToState(newValue), true);
    }
    /**
     * Disposes the resources used by this handler.
     *
     * This method is idempotent, meaning it can be called multiple times without adverse effects.
     */
    dispose() {
        this.disposable?.dispose();
    }
}
/**
 * Handles property changed events for a specific property of a component and updates the corresponding ioBroker state.
 *
 * @template T The component type.
 * @template P The property key of the component.
 */
export class PercentagePropertyChangedHandler extends SimplePropertyChangedHandler {
    /**
     * Called when the linked property changes.
     *
     * Maps the value of the property to a number and multiplies it by 100 before updating the corresponding
     * ioBroker state.
     *
     * @param newValue The new value of the property.
     * @returns A promise that resolves when the state has been updated.
     */
    async onPropertyChangedTypedEvent(newValue) {
        await this.Adapter.setState(this.StateId, Math.round(MapAnyPropertyToState(newValue) * 100), true);
    }
}
export const klfPromiseQueue = new PromiseQueue();
/**
 * Handles state changed events for a specific state.
 *
 * @template T The component type.
 * @template P The property key of the component.
 */
export class BaseStateChangeHandler {
    Adapter;
    StateId;
    /**
     * Creates a new instance of the BaseStateChangeHandler.
     *
     * @param Adapter The ioBroker adapter instance to be used by the handler.
     * @param StateId The ID of the state that this handler will monitor for changes.
     */
    constructor(Adapter, StateId) {
        this.Adapter = Adapter;
        this.StateId = StateId;
        /// The default number of listeners may not be high enough -> raise it to suppress warnings
        const adapterEmitter = this.Adapter;
        const newMaxSize = adapterEmitter.getMaxListeners() + 1;
        this.logEventEmitterMaxSize(newMaxSize);
        adapterEmitter.setMaxListeners(newMaxSize);
    }
    /**
     * Logs the new maximum size of event listeners for the adapter.
     *
     * @param newMaxSize The new maximum number of event listeners allowed for the adapter.
     */
    logEventEmitterMaxSize(newMaxSize) {
        this.Adapter.log.debug(`Set maximum number of event listeners of adapter to ${newMaxSize}.`);
    }
    /**
     * The method to call when the state changes.
     *
     * @param _state The new state or null if the state was deleted.
     * @returns A promise that resolves when the event has been handled.
     * @throws Error If the method is called without being implemented by a subclass.
     */
    async onStateChange(_state) {
        return Promise.reject(new Error("Method not implemented."));
    }
    /**
     * Private method that is called when a state changed event is received.
     *
     * If the event is for the state that this handler is monitoring, it calls the abstract
     * `onStateChange` method to handle the event.
     *
     * If the event is not for the monitored state, it does nothing.
     *
     * @param id The ID of the state that changed.
     * @param obj The new state or null if the state was deleted.
     * @returns A promise that resolves when the event has been handled.
     */
    async stateChanged(id, obj) {
        if (id === `${this.Adapter.namespace}.${this.StateId}`) {
            this.Adapter.log.silly(`State changed event received for id ${id}. New state: ${JSON.stringify(obj)}. Handled by ${this.constructor.name}`);
            try {
                await this.onStateChange(obj);
            }
            catch (error) {
                this.Adapter.log.error(`Couldn't set state ${id} to value ${obj?.val?.toLocaleString()}: ${error.message}`);
                if (error instanceof Error && error.stack) {
                    this.Adapter.log.debug(error.stack);
                }
                if (obj) {
                    const errorState = {
                        val: obj.val,
                        q: /* ioBroker.STATE_QUALITY.DEVICE_ERROR_REPORT */ 68,
                        ack: true,
                    };
                    await this.Adapter.setState(id, errorState);
                }
            }
        }
    }
    /**
     * Disposes the handler and all its resources.
     *
     * This method is idempotent, meaning it can be called multiple times without adverse effects.
     *
     * @returns A promise that resolves when the handler has been disposed.
     */
    async dispose() {
        try {
            await this.Adapter.unsubscribeStatesAsync(this.StateId);
        }
        finally {
            const adapterEmitter = this.Adapter;
            const newMaxSize = Math.max(adapterEmitter.getMaxListeners() - 1, 0);
            this.logEventEmitterMaxSize(newMaxSize);
            adapterEmitter.setMaxListeners(newMaxSize);
        }
    }
    /**
     * Initializes the handler.
     *
     * Binds the {@link stateChanged} method to the `stateChange` event of the adapter and
     * subscribes to the state change event for the state monitored by this handler.
     *
     * @returns A promise that resolves when the handler has been initialized.
     */
    async Initialize() {
        // Bind the stateChanged function to the stateChange event
        this.Adapter.on("stateChange", this.stateChanged.bind(this));
        // Listen to the corresponding stateChange event
        await this.Adapter.subscribeStatesAsync(this.StateId);
    }
}
/**
 * A state change handler that simply echos the state change event to the adapter.
 */
export class EchoStateChangeHandler extends BaseStateChangeHandler {
    /**
     * The method to call when the state changes.
     *
     * If the new state is not acknowledged, it will be acknowledged by the adapter.
     *
     * @param state The new state or null if the state was deleted.
     * @returns A promise that resolves when the event has been handled.
     */
    async onStateChange(state) {
        if (state?.ack === false) {
            await this.Adapter.setState(this.StateId, state.val, true);
        }
    }
}
/**
 * A state change handler that calls a setter method on a component.
 */
export class SetterStateChangeHandler extends BaseStateChangeHandler {
    LinkedObject;
    SetterMethodName;
    /**
     * Creates a new instance of SetterStateChangeHandler.
     *
     * @param Adapter The ioBroker adapter that should be used to register the event handler.
     * @param StateId The ID of the state that should be monitored.
     * @param LinkedObject The object that owns the property that should be set.
     * @param SetterMethodName The name of the setter method that should be called when the state changes.
     */
    constructor(Adapter, StateId, LinkedObject, SetterMethodName) {
        super(Adapter, StateId);
        this.LinkedObject = LinkedObject;
        this.SetterMethodName = SetterMethodName;
        this.Adapter.log.debug(`Create a setter state change handler to listen to state ${this.StateId} linked to property ${String(this.SetterMethodName)} on type ${this.LinkedObject.constructor.name}.`);
        // Double check, that the setter method exists
        if (typeof LinkedObject[this.SetterMethodName] === "function") {
            this.setterFunction = LinkedObject[this.SetterMethodName];
        }
        else {
            throw new Error(`${String(this.SetterMethodName)} is not a function.`);
        }
    }
    setterFunction;
    /**
     * Gets the setter function that was set in the constructor.
     *
     * The setter function is the method that will be called when the state changes.
     * The method will be called with the new value of the state as the first argument.
     *
     * @returns The setter function.
     */
    get SetterFunction() {
        return this.setterFunction;
    }
    /**
     * Handles the state change event for the associated ioBroker state.
     *
     * Logs the state change event and, if the state is not acknowledged, calls the
     * associated setter function on the linked object with the new state value.
     *
     * @param state The new state or null if the state was deleted.
     * @returns A promise that resolves when the event has been handled.
     */
    async onStateChange(state) {
        this.Adapter.log.debug(`SetterStateChangeHandler.onStateChange: ${JSON.stringify(state)}`);
        if (state?.ack === false) {
            await klfPromiseQueue
                .push((async () => {
                await this.setterFunction.call(this.LinkedObject, state.val);
            }).bind(this))
                .waitAsync();
        }
    }
}
/**
 * A state change handler that calls a setter method on a component.
 */
export class SimpleStateChangeHandler extends SetterStateChangeHandler {
    Property;
    /**
     * Constructs an instance of SimpleStateChangeHandler.
     *
     * @param Adapter The ioBroker adapter used for registering the event handler.
     * @param StateId The ID of the state to be monitored.
     * @param Property The property of the linked component to be observed.
     * @param LinkedObject The component instance that owns the property.
     * @param SetterMethodName Optional name of the setter method to call when the state changes.
     *                          Defaults to `set<Property>Async` if not provided.
     */
    constructor(Adapter, StateId, Property, LinkedObject, SetterMethodName) {
        super(Adapter, StateId, LinkedObject, SetterMethodName ?? `set${String(Property)}Async`);
        this.Property = Property;
        this.Adapter.log.debug(`Create a simple state change handler to listen to state ${this.StateId} linked to property ${String(this.Property)} on type ${this.LinkedObject.constructor.name}.`);
    }
}
/**
 * A state change handler that calls a setter method on a component.
 * The value of the state is expected to be a percentage.
 */
export class PercentageStateChangeHandler extends SetterStateChangeHandler {
    /**
     * Handles the state change event for the associated ioBroker state.
     *
     * Converts the state value from a percentage to a value between 0 and 1.
     * Calls the setter function on the linked object with the new state value.
     *
     * @param state The new state or null if the state was deleted.
     * @returns A promise that resolves when the event has been handled.
     */
    async onStateChange(state) {
        if (state?.ack === false) {
            await klfPromiseQueue
                .push((async () => {
                await this.SetterFunction.call(this.LinkedObject, state.val / 100);
            }).bind(this))
                .waitAsync();
        }
    }
}
/**
 * A state change handler that calls a setter method on a component.
 * To handle complex scenarios, a custom handler function can be provided.
 */
export class ComplexStateChangeHandler extends BaseStateChangeHandler {
    Handler;
    /**
     * Constructs an instance of ComplexStateChangeHandler.
     *
     * @param Adapter The ioBroker adapter that should be used to register the event handler.
     * @param StateId The ID of the state that should be monitored.
     * @param Handler The custom function that should be called when the state changes.
     */
    constructor(Adapter, StateId, Handler) {
        super(Adapter, StateId);
        this.Handler = Handler;
    }
    /**
     * Handles the state change event for the associated ioBroker state.
     *
     * When the state changes, this function will be called.
     * The function will be called with the new state value as an argument.
     * If the state was deleted, the argument will be null.
     *
     * This function will push the custom handler function to the promise queue
     * and wait until it has finished execution.
     * This ensures that the custom handler function is not called multiple times in parallel.
     *
     * @param state The new state or null if the state was deleted.
     * @returns A promise that resolves when the event has been handled.
     */
    async onStateChange(state) {
        if (state?.ack === false) {
            await klfPromiseQueue
                .push((async () => {
                await this.Handler(state);
            }).bind(this))
                .waitAsync();
        }
    }
}
/**
 * A state change handler that calls a method on a component.
 */
export class MethodCallStateChangeHandler extends ComplexStateChangeHandler {
    LinkedObject;
    MethodName;
    ArgumentProvider;
    targetMethod;
    /**
     * Constructs an instance of MethodCallStateChangeHandler.
     *
     * When the associated state changes, this handler will call the specified method on the component.
     * If the state was deleted, the method will not be called.
     * The method will be called with the value of the state as the first argument.
     * Additionally, if an argument provider function is provided, the method will be called with the arguments
     * returned by the provider function.
     *
     * @param Adapter The ioBroker adapter that should be used to register the event handler.
     * @param StateId The ID of the state that should be monitored.
     * @param LinkedObject The component that owns the method that should be called.
     * @param MethodName The name of the method to be called.
     * @param ArgumentProvider An optional function that provides the arguments for the method call.
     * If not provided, the method will be called without arguments.
     */
    constructor(Adapter, StateId, LinkedObject, MethodName, ArgumentProvider) {
        super(Adapter, StateId, async (state) => {
            await this.Adapter.setState(this.StateId, state !== null && state !== undefined ? state : null, true);
            if (state?.val) {
                this.Adapter.log.silly(`Calling method ${String(this.MethodName)} on class ${LinkedObject.constructor.name}`);
                if (this.ArgumentProvider) {
                    const args = await this.ArgumentProvider(state);
                    await this.targetMethod(...args);
                }
                else {
                    await this.targetMethod();
                }
                await this.Adapter.setState(this.StateId, false, true);
            }
        });
        this.LinkedObject = LinkedObject;
        this.MethodName = MethodName;
        this.ArgumentProvider = ArgumentProvider;
        this.targetMethod = this.LinkedObject[this.MethodName].bind(LinkedObject);
    }
}
//# sourceMappingURL=propertyLink.js.map