# Argo CD on EKS — GitOps for the Todo App

After CI pushes the image and updates `deployment.yaml` in Git, **Argo CD** (running inside the cluster) pulls manifests from Git and applies them to EKS → pods roll out with the new image tag.

## Prerequisites

- `kubectl` points at the correct EKS cluster (`aws eks update-kubeconfig ...`)
- The GitHub repo has a `main` branch and the paths `k8s/deployment.yaml`, `k8s/service.yaml`

## Step 1 — Install Argo CD

```bash
kubectl create namespace argocd

kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

Wait until all `argocd-*` pods in the `argocd` namespace are running:

```bash
kubectl get pods -n argocd -w
# Ctrl+C when all are Running
```

## Step 2 — Open the Argo CD UI (LoadBalancer)

```bash
kubectl patch svc argocd-server -n argocd -p '{"spec":{"type":"LoadBalancer"}}'

kubectl get svc argocd-server -n argocd
```

Use the **EXTERNAL-IP** column (ELB DNS), open a browser: **`https://<EXTERNAL-IP>`**  
(Argo CD uses a self-signed certificate → the browser will warn you; choose Continue / Advanced.)

**User:** `admin`  
**Password:**

```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d && echo
```

## Step 3 — Private repository (skip if the repo is public)

Create a GitHub PAT (repo read) and run:

```bash
kubectl create secret generic github-repo \
  -n argocd \
  --from-literal=type=git \
  --from-literal=url=https://github.com/YOUR_USER/YOUR_REPO.git \
  --from-literal=password=ghp_XXXXXXXXXXXX

kubectl label secret github-repo -n argocd argocd.argoproj.io/secret-type=repository
```

(Replace the URL and token. For HTTPS, the username can be empty or you can use the token as the password with user `git` — depending on how you configure it.)

In the UI: **Settings → Repositories** and confirm the connection is healthy.

## Step 4 — Register the Application

1. Edit `k8s/argocd-application.yaml`: replace `YOUR_GITHUB_USER/YOUR_REPO_NAME` with your real repo (or set `repoURL` as in your project).
2. Apply (only needed **once**):

```bash
kubectl apply -f k8s/argocd-application.yaml
```

In the Argo CD UI you should see the **todo-app** application → **Sync** (or wait for auto-sync if enabled in the manifest).

## Step 5 — Verify the end-to-end flow

1. Change code → `git push origin main`
2. GitHub Actions: test → build image → commit updated `deployment.yaml` (SHA tag)
3. Argo CD (by default polls Git about every ~3 minutes) detects the change → sync → Deployment updates the image → rollout

Quick checks:

```bash
kubectl get pods -l app=todo-app -w
kubectl describe deployment todo-app | grep Image:
```

## Uninstall (when no longer needed)

```bash
kubectl delete -f k8s/argocd-application.yaml
kubectl delete namespace argocd
```

---

## Role summary

| Component | Responsibility |
|-----------|----------------|
| **GitHub Actions** | Build image, push to Docker Hub, update manifests in Git |
| **Argo CD** | Watch Git, apply manifests to EKS |
| **EKS** | Runs Deployment/Service; kubelet pulls the new image when the spec changes |
