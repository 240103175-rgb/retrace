output "url" {
  description = "HTTPS through sslip.io (certificate issued on the first request)"
  value       = "https://${replace(google_compute_instance.app.network_interface[0].access_config[0].nat_ip, ".", "-")}.sslip.io"
}

output "instance" {
  value = google_compute_instance.app.name
}

output "workload_identity_provider" {
  description = "GitHub variable GCP_WORKLOAD_IDENTITY_PROVIDER"
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "deployer_service_account" {
  description = "GitHub variable GCP_SERVICE_ACCOUNT"
  value       = google_service_account.deployer.email
}
