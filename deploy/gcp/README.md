# Google Cloud with Terraform (#113)

The Terraform alternative to CloudFormation. Always-free resources only: one **e2-micro** VM in
`us-central1` (or `us-west1` / `us-east1`), a 30 GB **standard** persistent disk, an ephemeral external IP and
two firewall rules. The startup script installs Docker and runs `deploy/compose.prod.yaml`
(app image from GHCR, PostgreSQL, Caddy with HTTPS through `<ip>.sslip.io`).

GitHub Actions deploys through **Workload Identity Federation** (only `main` of this repository), over an IAP SSH tunnel —
no service-account keys.

> Free tier: keep the region and machine type. A reserved static IP, Cloud SQL or a load balancer are billed.
> Set a budget alert in Billing → Budgets. `terraform destroy` removes everything.

## Apply

```bash
gcloud auth application-default login
cd deploy/gcp
cp terraform.tfvars.example terraform.tfvars   # project id and passwords; never committed
terraform init
terraform apply
terraform output
```

## Continuous deployment

Repository variables: `GCP_WORKLOAD_IDENTITY_PROVIDER` and `GCP_SERVICE_ACCOUNT` (outputs),
`GCP_ZONE` (e.g. `us-central1-a`) and `GCP_URL` (output `url`). Job `deploy-gcp` then redeploys every
commit to `main` that passes the tests.

## Destroy

```bash
terraform destroy
```
