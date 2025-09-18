import * as core from '@actions/core';
import * as httpm from '@actions/http-client';

async function run(): Promise<void> {
    try {
        const nugetUsername: string = core.getInput('user', { required: true });
        const nugetTokenServiceUrl: string = core.getInput('token-service-url') || 'https://www.nuget.org/api/v2/token';
        const nugetAudience: string = core.getInput('audience') || 'https://www.nuget.org';

        const oidcToken: string = await core.getIDToken(nugetAudience);

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
            let errorMessage = `Token exchange failed (${response.message.statusCode})`;

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