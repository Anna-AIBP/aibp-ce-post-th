// Alias route — the report lives at "/" in this standalone project, but the
// original CE app served it at "/report". This keeps that older URL working
// so anything already shared against /report doesn't 404.
export { default } from '../page'
