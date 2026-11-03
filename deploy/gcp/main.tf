# Re:Trace on Google Cloud's always-free tier (#113): one e2-micro VM in a free region running
# Docker Compose (app image from GHCR, PostgreSQL, Caddy). GitHub Actions deploys through
# Workload Identity Federation — no service-account key files.

terraform {
  required_version = ">= 1.6"
  required_providers {
    google = { source = "hashicorp/google", version = "~> 6.0" }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

resource "google_project_service" "compute" {
  service            = "compute.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "iam" {
  for_each           = toset(["iam.googleapis.com", "iamcredentials.googleapis.com", "sts.googleapis.com"])
  service            = each.value
  disable_on_destroy = false
}

resource "google_compute_firewall" "web" {
  name          = "retrace-web"
  network       = "default"
  direction     = "INGRESS"
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["retrace"]
  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }
  depends_on = [google_project_service.compute]
}

# SSH only from Google's IAP range, used by the deploy job (gcloud compute ssh --tunnel-through-iap).
resource "google_compute_firewall" "iap_ssh" {
  name          = "retrace-iap-ssh"
  network       = "default"
  direction     = "INGRESS"
  source_ranges = ["35.235.240.0/20"]
  target_tags   = ["retrace"]
  allow {
    protocol = "tcp"
    ports    = ["22"]
  }
  depends_on = [google_project_service.compute]
}

resource "google_compute_instance" "app" {
  name         = "retrace"
  machine_type = "e2-micro" # always free in us-west1, us-central1, us-east1
  tags         = ["retrace"]

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-12"
      size  = 30            # free tier: 30 GB standard persistent disk
      type  = "pd-standard" # pd-balanced/ssd are not free
    }
  }

  network_interface {
    network = "default"
    access_config {} # ephemeral external IP (a reserved static IP can be billed)
  }

  metadata = {
    enable-oslogin = "TRUE"
    startup-script = templatefile("${path.module}/startup.sh.tftpl", {
      repo              = var.github_repo
      git_ref           = var.git_ref
      app_image         = var.app_image
      admin_password    = var.admin_password
      postgres_password = var.postgres_password
      seed_demo         = var.seed_demo
    })
  }

  scheduling {
    preemptible       = false
    automatic_restart = true
  }

  shielded_instance_config {
    enable_secure_boot = true
  }

  depends_on = [google_project_service.compute]
}

# --- GitHub Actions → Google Cloud without keys ---------------------------------------
resource "google_service_account" "deployer" {
  account_id   = "retrace-deployer"
  display_name = "Re:Trace GitHub deployer"
  depends_on   = [google_project_service.iam]
}

resource "google_project_iam_member" "deployer_roles" {
  for_each = toset(["roles/compute.instanceAdmin.v1", "roles/compute.osAdminLogin", "roles/iap.tunnelResourceAccessor", "roles/iam.serviceAccountUser"])
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.deployer.email}"
}

resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github"
  display_name              = "GitHub Actions"
  depends_on                = [google_project_service.iam]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github"
  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }
  # Only this repository's main branch may deploy.
  attribute_condition = "assertion.repository == '${var.github_repo}' && assertion.ref == 'refs/heads/main'"
  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account_iam_member" "github_impersonation" {
  service_account_id = google_service_account.deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repo}"
}
