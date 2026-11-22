import type { Observable } from 'rxjs';

// Existing API services satisfy this contract without a shared implementation.
export interface CrudApi<TEntity, TRequest> {
    list(): Observable<TEntity[]>;
    get(id: string): Observable<TEntity>;
    create(request: TRequest): Observable<TEntity>;
    update(id: string, request: TRequest): Observable<TEntity>;
    delete(id: string): Observable<void>;
}
