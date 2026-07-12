declare class ConnectionTestResult {
    readonly stepOrder: number;
    readonly stepName: string;
    readonly run: boolean;
    readonly success?: boolean | undefined;
    readonly message?: string | undefined;
    readonly result?: (Error | string | number) | undefined;
    /**
     * Constructor for a ConnectionTestResult.
     *
     * @param stepOrder The step number of the test in the order of execution.
     * @param stepName A short description of the test step.
     * @param run A boolean indicating whether the test step was run.
     * @param success A boolean indicating whether the test step was successful.
     * @param message A string message giving more information about the test result.
     * @param result An optional result object that can be an Error, a string or a number.
     */
    constructor(stepOrder: number, stepName: string, run: boolean, success?: boolean | undefined, message?: string | undefined, result?: (Error | string | number) | undefined);
}
declare const ConnectionTestResultTableComponent: ({ testResults }: {
    testResults: ConnectionTestResult[];
}) => JSX.Element;
export default ConnectionTestResultTableComponent;
