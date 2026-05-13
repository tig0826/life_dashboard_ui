#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANSIBLE_DIR="$SCRIPT_DIR/../ansible"
IMAGE="tig0826/life-dashboard-ui:latest"
NAMESPACE="life"

# .env から API キーを読み込む
API_KEY=$(grep '^GOOGLE_GENERATIVE_AI_API_KEY' "$SCRIPT_DIR/.env" | cut -d= -f2- | tr -d '"')
if [[ -z "$API_KEY" ]]; then
  echo "ERROR: GOOGLE_GENERATIVE_AI_API_KEY not found in .env" >&2
  exit 1
fi

echo "==> [1/4] Building & pushing Docker image..."
docker buildx build --platform linux/amd64 -t "$IMAGE" --push "$SCRIPT_DIR"

echo "==> [2/4] Applying Kubernetes manifest..."
kubectl apply --validate=false -f "$SCRIPT_DIR/manifest.yaml"

echo "==> [3/4] Syncing Gemini API key to Secret..."
kubectl create secret generic life-dashboard-secret \
  --from-literal=GOOGLE_GENERATIVE_AI_API_KEY="$API_KEY" \
  -n "$NAMESPACE" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "==> [4/4] Updating DNS via Ansible..."
ansible-playbook -i "$ANSIBLE_DIR/inventory/hosts" \
  "$ANSIBLE_DIR/playbooks/dns.yml" --ask-vault-pass

echo ""
echo "Done. http://life.mynet"
