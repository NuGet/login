# NuGet Login (OIDC)

This GitHub Action enables secure, passwordless authentication to NuGet servers using OpenID Connect (OIDC). It obtains a short-lived NuGet API key by exchanging the GitHub OIDC token with your NuGet-compatible token service.

## 📦 Usage

```yaml
- name: NuGet Login
  uses: NetOfficeFw/nuget-login@v1
  id: nuget_auth
  with:
    user: my-nuget-username
```

This action outputs a temporary API key as `NUGET_API_KEY` which can be used in subsequent steps:

```yaml
- name: Push package
  run: |
    dotnet nuget push mypkg.nupkg \
      --api-key "${{ steps.nuget_auth.outputs.NUGET_API_KEY }}" \
      --source https://www.nuget.org/api/v2/package
```

## 🔐 Authentication Flow

1. GitHub generates an OIDC token scoped to your workflow.
2. This action exchanges the OIDC token with your NuGet-compatible token service.
3. A short-lived NuGet API key is returned for use in package publishing.


## 📥 Inputs

| Name               | Required | Description |
|--------------------|----------|-------------|
| `user`             | ✅ Yes   | Your NuGet account username. |
| `token-service-url`| ❌ No    | URL to your NuGet server's token endpoint (default: `https://www.nuget.org/api/v2/token`) |
| `audience`         | ❌ No    | OIDC audience (default: `https://www.nuget.org`) |

## 📤 Outputs

| Name              | Description |
|-------------------|-------------|
| `NUGET_API_KEY`   | The short-lived API key returned by the NuGet token service. |

## 🧪 Example

```yaml
name: Publish NuGet package

on:
  push:
    branches: [main]

permissions:
  id-token: write
  contents: read

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v6

    - name: NuGet Login
      uses: NetOfficeFw/nuget-login@v1
      id: nuget_auth
      with:
        user: my-nuget-username

    - name: Push package
      run: dotnet nuget push ./bin/*.nupkg --api-key "${{ steps.nuget_auth.outputs.NUGET_API_KEY }}" --source https://www.nuget.org/api/v2/package
```
