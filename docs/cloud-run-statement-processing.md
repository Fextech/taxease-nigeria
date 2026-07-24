# Statement processing on Cloud Run

The browser uploads the PDF directly to S3. The Next.js service then asks the
API service to create a Cloud Tasks HTTP task with its Cloud Run service
account. Cloud Tasks delivers it to the worker's
`POST /jobs/parse-statement` endpoint. The worker downloads from S3, calls the
parser, and writes the transactions to the database.

Cloud Build files in this repository only build container images. They do not
create the Cloud Tasks queue, grant IAM permissions, or set Cloud Run runtime
environment variables. Those three deployment steps are required before an
upload can be queued.

## Required runtime variables

Set these on the **API Cloud Run service** (`banklens-api`):

```text
GCP_PROJECT_ID=banklens-prod
GCP_TASKS_LOCATION=europe-west1
GCP_TASKS_QUEUE=banklens-jobs
WORKER_URL=https://YOUR-WORKER-URL
WORKER_SECRET=the-same-32-or-more-character-secret-used-by-worker
INTERNAL_API_SECRET=a-32-or-more-character-secret-shared-with-the-web-service
```

Set `WORKER_SECRET` on the **worker service** to the exact same value. Set
`API_URL` and `INTERNAL_API_SECRET` on the **web service** (for example,
Vercel) to reach and authenticate to `banklens-api`. The worker will not start
without `WORKER_SECRET`.

Create `INTERNAL_API_SECRET` in Secret Manager before attaching it to the API.
Use a new random value of at least 32 characters, and set the same value in the
web deployment. Do not reuse `WORKER_SECRET`.

If the worker is private (recommended), also set this on the API service:

```text
CLOUD_TASKS_INVOKER_SERVICE_ACCOUNT=cloud-tasks-worker-invoker@banklens-prod.iam.gserviceaccount.com
```

When present, the API attaches an OIDC token to every task in addition to its
existing `X-Worker-Secret` check.

## One-time Google Cloud setup

Use the actual Cloud Run service and service-account names for your project.

```bash
gcloud tasks queues create banklens-jobs \
  --project=banklens-prod \
  --location=europe-west1

gcloud projects add-iam-policy-binding banklens-prod \
  --member=serviceAccount:banklens-dispatcher@banklens-prod.iam.gserviceaccount.com \
  --role=roles/cloudtasks.enqueuer

gcloud run services update banklens-api \
  --project=banklens-prod \
  --region=europe-west1 \
  --update-env-vars=GCP_PROJECT_ID=banklens-prod,GCP_TASKS_LOCATION=europe-west1,GCP_TASKS_QUEUE=banklens-jobs,WORKER_URL=https://YOUR-WORKER-URL \
  --update-secrets=WORKER_SECRET=WORKER_SECRET:latest,INTERNAL_API_SECRET=INTERNAL_API_SECRET:latest
```

For a private worker, create or select the OIDC service account, grant it the
Cloud Run Invoker role on the worker, then set the optional variable above:

```bash
gcloud run services add-iam-policy-binding banklens-worker \
  --project=banklens-prod \
  --region=europe-west1 \
  --member=serviceAccount:cloud-tasks-worker-invoker@banklens-prod.iam.gserviceaccount.com \
  --role=roles/run.invoker

gcloud run services update banklens-api \
  --project=banklens-prod \
  --region=europe-west1 \
  --update-env-vars=CLOUD_TASKS_INVOKER_SERVICE_ACCOUNT=cloud-tasks-worker-invoker@banklens-prod.iam.gserviceaccount.com
```

The Cloud Tasks service agent also needs permission to mint OIDC tokens for
that invoker service account (`roles/iam.serviceAccountTokenCreator`).

## Verification

After deployment, upload a statement and inspect the API logs. `createTask`
must succeed. Then inspect the queue and worker logs:

```bash
gcloud tasks list --project=banklens-prod --location=europe-west1 --queue=banklens-jobs
gcloud run services logs read banklens-worker --project=banklens-prod --region=europe-west1 --limit=100
```

If task creation fails, the Statement record is retained with `parseStatus`
`ERROR`. The Statements page now provides **Retry processing**, which creates a
new task without re-uploading the PDF or consuming another upload.
