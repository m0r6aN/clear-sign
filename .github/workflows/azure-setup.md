# Azure Static Web Apps — One-time Setup

Run these steps once in the Azure portal / CLI. Nothing here belongs in the repo.

## 1. Create the SWA resource

```bash
az group create --name clearsign-rg --location eastus2
az staticwebapp create \
  --name clearsign \
  --resource-group clearsign-rg \
  --location eastus2 \
  --sku Free \
  --source https://github.com/<org>/clear-sign \
  --branch main \
  --app-location / \
  --output-location dist \
  --api-location api \
  --login-with-github
```

The CLI prints a deploy token. Add it as a GitHub secret:
  Name: `AZURE_STATIC_WEB_APPS_API_TOKEN`

## 2. Set Application Settings (server-side only — never in repo)

```bash
az staticwebapp appsettings set \
  --name clearsign \
  --resource-group clearsign-rg \
  --setting-names \
    ANTHROPIC_API_KEY="<sk-ant-...>" \
    STRIPE_SECRET_KEY="<sk_live_...>" \
    STRIPE_WEBHOOK_SECRET="<whsec_...>" \
    AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=<acct>;AccountKey=<key>;EndpointSuffix=core.windows.net"
```

These are injected into `process.env` in the Azure Functions runtime. The
frontend never sees them.

## 3. Custom domain + SSL

```bash
# After DNS propagates, bind the apex domain
az staticwebapp hostname set \
  --name clearsign \
  --resource-group clearsign-rg \
  --hostname clearsign.cc

# Validate via TXT record or CNAME as prompted, then issue the managed cert:
az staticwebapp hostname set \
  --name clearsign \
  --resource-group clearsign-rg \
  --hostname clearsign.cc \
  --validation-method cname-delegation
```

DNS records to create at your registrar:
```
clearsign.cc  ALIAS / CNAME  <swa-default-hostname>.azurestaticapps.net
www           CNAME          <swa-default-hostname>.azurestaticapps.net
```

SSL is provisioned automatically (managed cert) once DNS resolves.

## 4. Stripe webhook

Point Stripe to:
  `https://clearsign.cc/api/stripe-webhook`

Events to subscribe: `checkout.session.completed`, `payment_intent.payment_failed`

Copy the signing secret into the `STRIPE_WEBHOOK_SECRET` app setting above.

## 5. Validation checklist

```bash
# Preview env from a PR
curl https://<pr-preview-url>/api/credits
# Expected: {"credits": 2}  (anonymous clientId)

# Production
curl https://clearsign.cc/api/credits
# Expected: {"credits": 2}

# Custom domain cert
curl -Iv https://clearsign.cc 2>&1 | grep -E "SSL|subject|issuer|expire"
```
