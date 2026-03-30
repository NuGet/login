import * as core from '@actions/core';
import * as httpm from '@actions/http-client';

async function run(): Promise<void> {
    try {
        const nugetUsername: string = core.getInput('user', { required: true });
        const nugetTokenServiceUrl: string = core.getInput('token-service-url') || 'https://www.nuget.org/api/v2/token';
        const nugetAudience: string = core.getInput('audience') || 'https://www.nuget.org';

        // Get OIDC environment values
        const oidcRequestToken: string | undefined = process.env['ACTIONS_ID_TOKEN_REQUEST_TOKEN'];
        const oidcRequestUrl: string | undefined = process.env['ACTIONS_ID_TOKEN_REQUEST_URL'];

        if (!oidcRequestToken && !oidcRequestUrl) {
            throw new Error(
                'GitHub OIDC is not available. Ensure your workflow has the required permissions:\n' +
                '  permissions:\n' +
                '    id-token: write\n' +
                '    contents: read'
            );
        }

        if (!oidcRequestToken) {
            throw new Error(
                'ACTIONS_ID_TOKEN_REQUEST_TOKEN is missing. Ensure your workflow has:\n' +
                '  permissions:\n' +
                '    id-token: write'
            );
        }

        if (!oidcRequestUrl) {
            throw new Error(
                'ACTIONS_ID_TOKEN_REQUEST_URL is missing. Ensure your workflow has:\n' +
                '  permissions:\n' +
                '    id-token: write'
            );
        }

        // Mask OIDC tokens
        core.setSecret(oidcRequestToken);

        const tokenUrl: string = `${oidcRequestUrl}&audience=${encodeURIComponent(nugetAudience)}`;

        const http: httpm.HttpClient = new httpm.HttpClient();
        const tokenResponse = await http.getJson<{ value?: string }>(tokenUrl, {
            Authorization: `Bearer ${oidcRequestToken}`,
        });

        if (!tokenResponse.result || !tokenResponse.result.value) {
            throw new Error(
                `Failed to retrieve OIDC token from GitHub (HTTP ${tokenResponse.statusCode}). ` +
                'Verify that the audience is correct and that the token service URL is reachable.'
            );
        }

        const oidcToken: string = tokenResponse.result.value;
        core.setSecret(oidcToken);

        // Build the request body
        const body: string = JSON.stringify({
            username: nugetUsername,
            tokenType: 'ApiKey'
        });

        // Prepare headers
        const headers: { [key: string]: string } = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${oidcToken}`,
            'User-Agent': 'nuget/login-action'
        };

        const tokenServiceHttpClient: httpm.HttpClient = new httpm.HttpClient();
        const response: httpm.HttpClientResponse = await tokenServiceHttpClient.post(nugetTokenServiceUrl, body, headers);

        if (response.message.statusCode !== 200) {
            const errorBody = await response.readBody();
            let errorMessage = `Token exchange failed (HTTP ${response.message.statusCode}) at ${nugetTokenServiceUrl}. Make sure you are using the username of the policy creator, not the policy owner`;

            try {
                const errorJson = JSON.parse(errorBody);
                if (errorJson && typeof errorJson.error === 'string') {
                    errorMessage += `: ${errorJson.error}`;
                } else {
                    errorMessage += `: ${errorBody}`;
                }
            } catch {
                errorMessage += `: ${errorBody}`;
            }

            throw new Error(errorMessage);
        }

        const responseBody = await response.readBody();

        const data: { apiKey?: string } = JSON.parse(responseBody);
        if (!data.apiKey) {
            throw new Error('Response did not contain "apiKey".');
        }

        const apiKey: string = data.apiKey;
        core.setSecret(apiKey);
        core.setOutput('NUGET_API_KEY', apiKey);
        core.info('Successfully exchanged OIDC token for NuGet API key.');
    } catch (error: unknown) {
        if (error instanceof Error) {
            core.setFailed(error.message);
        } else {
            core.setFailed('Unknown error occurred');
        }
    }
}

run();