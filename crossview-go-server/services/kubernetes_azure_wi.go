package services

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/policy"
	"github.com/Azure/azure-sdk-for-go/sdk/azidentity"
	"k8s.io/client-go/rest"
)

// aksAADServerAppID is the well-known AAD server application ID for AKS,
// used as the default --server-id by kubelogin when none is supplied.
const aksAADServerAppID = "6dae42f8-4368-4678-94ff-3960e28e3630"

// isAzureWorkloadIdentityEnv reports whether the pod has been mutated by the
// Azure Workload Identity webhook and a federated token file is available.
func isAzureWorkloadIdentityEnv() bool {
	return os.Getenv("AZURE_FEDERATED_TOKEN_FILE") != "" &&
		os.Getenv("AZURE_CLIENT_ID") != "" &&
		os.Getenv("AZURE_TENANT_ID") != ""
}

// applyAzureWorkloadIdentity replaces a kubelogin-based exec plugin on the
// given context with a native azidentity.WorkloadIdentityCredential-backed
// bearer-token transport wrapper. It is a no-op when the pod does not have
// Azure Workload Identity configured or when the context does not use kubelogin.
func (k *KubernetesService) applyAzureWorkloadIdentity(restConfig *rest.Config, ctxName string) error {
	if !isAzureWorkloadIdentityEnv() {
		return nil
	}

	kctx, ok := k.kubeConfig.Contexts[ctxName]
	if !ok || kctx == nil {
		return nil
	}
	authInfo, ok := k.kubeConfig.AuthInfos[kctx.AuthInfo]
	if !ok || authInfo == nil || authInfo.Exec == nil {
		return nil
	}
	if !isKubeloginExec(authInfo.Exec.Command, authInfo.Exec.Args) {
		return nil
	}

	scope := extractServerID(authInfo.Exec.Args)
	if scope == "" {
		scope = aksAADServerAppID
	}

	cred, err := azidentity.NewWorkloadIdentityCredential(nil)
	if err != nil {
		return fmt.Errorf("create workload identity credential: %w", err)
	}

	// Drop kubelogin exec auth in favour of the native token wrapper.
	restConfig.ExecProvider = nil
	restConfig.BearerToken = ""
	restConfig.BearerTokenFile = ""

	restConfig.Wrap(func(rt http.RoundTripper) http.RoundTripper {
		return &azureBearerTransport{
			base:  rt,
			cred:  cred,
			scope: scope + "/.default",
		}
	})

	k.logger.Infof("Azure Workload Identity enabled for context '%s' (scope=%s)", ctxName, scope)
	return nil
}

// isKubeloginExec reports whether the exec plugin command looks like a
// kubelogin get-token invocation.
func isKubeloginExec(command string, args []string) bool {
	if filepath.Base(command) != "kubelogin" {
		return false
	}
	for _, a := range args {
		if a == "get-token" {
			return true
		}
	}
	return false
}

// extractServerID returns the value passed to --server-id in the exec args,
// or an empty string if none is present.
func extractServerID(args []string) string {
	for i, a := range args {
		switch {
		case a == "--server-id" && i+1 < len(args):
			return args[i+1]
		case strings.HasPrefix(a, "--server-id="):
			return strings.TrimPrefix(a, "--server-id=")
		}
	}
	return ""
}

// azureBearerTransport injects an AAD access token from a workload-identity
// credential on every request. azidentity caches tokens internally and
// refreshes them near expiry, so no additional caching is required here.
type azureBearerTransport struct {
	base  http.RoundTripper
	cred  azcore.TokenCredential
	scope string
}

func (t *azureBearerTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	if req.Header.Get("Authorization") != "" {
		return t.base.RoundTrip(req)
	}

	tokenCtx, cancel := context.WithTimeout(req.Context(), 15*time.Second)
	defer cancel()
	token, err := t.cred.GetToken(tokenCtx, policy.TokenRequestOptions{
		Scopes: []string{t.scope},
	})
	if err != nil {
		return nil, fmt.Errorf("acquire Azure AD token: %w", err)
	}

	reqCopy := req.Clone(req.Context())
	reqCopy.Header.Set("Authorization", "Bearer "+token.Token)
	return t.base.RoundTrip(reqCopy)
}
