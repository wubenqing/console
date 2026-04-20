export interface GpustackPagination {
  page: number
  perPage: number
  total: number
  totalPage: number
}

export interface GpustackPageResponse<T> {
  items: T[]
  pagination: GpustackPagination
}

export interface GpustackModel {
  id: number
  name: string
  source?: string
  huggingface_repo_id?: string
  huggingface_filename?: string
  model_scope_model_id?: string
  model_scope_file_path?: string
  local_path?: string
  backend?: string
  backend_version?: string
  replicas?: number
  ready_replicas?: number
  backend_parameters?: string[]
  env?: Record<string, string>
}

export interface GpustackModelInstance {
  id: number
  model_id: number
  name: string
  state?: string
}
