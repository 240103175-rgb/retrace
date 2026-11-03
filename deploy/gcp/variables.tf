variable "project_id" {
  type        = string
  description = "Google Cloud project id"
}

variable "region" {
  type        = string
  default     = "us-central1"
  description = "An always-free region for e2-micro: us-west1, us-central1 or us-east1"
  validation {
    condition     = contains(["us-west1", "us-central1", "us-east1"], var.region)
    error_message = "e2-micro is free only in us-west1, us-central1 and us-east1."
  }
}

variable "zone" {
  type    = string
  default = "us-central1-a"
}

variable "github_repo" {
  type    = string
  default = "240103175-rgb/retrace"
}

variable "git_ref" {
  type    = string
  default = "main"
}

variable "app_image" {
  type    = string
  default = "ghcr.io/240103175-rgb/retrace:latest"
}

variable "admin_password" {
  type      = string
  sensitive = true
  validation {
    condition     = length(var.admin_password) >= 12
    error_message = "admin_password must be at least 12 characters."
  }
}

variable "postgres_password" {
  type      = string
  sensitive = true
  validation {
    condition     = can(regex("^[A-Za-z0-9]{16,}$", var.postgres_password))
    error_message = "postgres_password: 16+ letters and digits."
  }
}

variable "seed_demo" {
  type    = bool
  default = true
}
