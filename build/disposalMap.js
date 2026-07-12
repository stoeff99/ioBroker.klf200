/** A map of disposables. */
export class DisposalMap extends Map {
    /**
     * Disposes all Disposables that start with the given id.
     *
     * @param id The id to dispose
     */
    async disposeId(id) {
        const idList = [];
        // Get a list of matching ids.
        for (const key of this.keys()) {
            if (key.startsWith(id)) {
                idList.push(key);
            }
        }
        // Call the Dispose method of the Disposables and remove the id from the map.
        for (const key of idList) {
            await Promise.resolve(this.get(key)?.dispose());
            this.delete(key);
        }
    }
    /** Disposes all Disposables in the map. */
    async disposeAll() {
        for (const disposable of this.values()) {
            await Promise.resolve(disposable.dispose());
        }
        this.clear();
    }
}
//# sourceMappingURL=disposalMap.js.map