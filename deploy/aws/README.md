# AWS with CloudFormation (#112)

One stack, free-tier resources only: a t3.micro EC2 instance (750 h/month free), a 20 GB gp3 volume
(30 GB free), an Elastic IP attached to the running instance, a VPC with one public subnet and no NAT
gateway. Docker Compose on the instance runs the app image from GHCR, PostgreSQL and Caddy
(HTTPS through `<ip>.sslip.io`). The stack also creates a **USD 1 budget alert** and a GitHub OIDC
deploy role that can only run a redeploy command on this instance.

> Stay in the free account. Do not upgrade the plan, enable "unlimited" CPU credits, add RDS, a load
> balancer or a NAT gateway. Delete the stack when you no longer need it.

## Create

Prerequisites: an AWS account (free plan), the AWS CLI signed in with an admin user **for this first
create only**, and the GHCR package `retrace` set to public (GitHub → Packages → retrace → visibility),
so the instance can pull it without credentials.

```bash
aws cloudformation deploy \
  --stack-name retrace \
  --template-file deploy/aws/retrace-stack.yaml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
      AdminPassword='a-long-admin-password' \
      PostgresPassword='LettersAndDigits0123456789' \
      BudgetEmail='you@example.com'
aws cloudformation describe-stacks --stack-name retrace --query 'Stacks[0].Outputs'
```

Add `CreateGitHubOidcProvider=false` if the account already has the GitHub OIDC provider.

## Continuous deployment

Set repository **variables** (Settings → Secrets and variables → Actions → Variables):

| Variable | Value |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | output `DeployRoleArn` |
| `AWS_INSTANCE_ID` | output `InstanceId` |
| `AWS_REGION` | the stack's region |
| `AWS_URL` | output `Url` |

Every commit to `main` that passes all tests then publishes the image and runs `docker compose pull app && up -d`
on the instance through SSM, followed by a health check (`.github/workflows/ci.yml`, job `deploy-aws`).

## Delete

```bash
aws cloudformation delete-stack --stack-name retrace
aws cloudformation wait stack-delete-complete --stack-name retrace
```

All data on the instance is deleted with it.
