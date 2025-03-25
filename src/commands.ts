import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';
import {LaunchConfig, BusinessCentralEnvironment,BCAuth, AuthToken} from './interfaces';


export function registerDeployCommand(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
    const deployCommand = vscode.commands.registerCommand('bc-pte-deployment.deploy', async () => {
        await executeDeployCommand(outputChannel, buildSolution);
    });
    context.subscriptions.push(deployCommand);
}

export function registerDeployWithIncrementCommand(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
    const deployWithIncrementCommand = vscode.commands.registerCommand('bc-pte-deployment.deployWithIncrement', async () => {
        await executeDeployCommand(outputChannel, buildSolutionWithIncrement);
    });
    context.subscriptions.push(deployWithIncrementCommand);
}

async function executeDeployCommand(
    outputChannel: vscode.OutputChannel,
    buildFunction: () => Promise<boolean>
) {
    try {
        outputChannel.clear();
        outputChannel.appendLine('Starting deployment process...');
        outputChannel.show(true);
        await new Promise(resolve => setTimeout(resolve, 100));

        // Check if we're in an AL project
        outputChannel.appendLine('Checking if the project is an AL project...');
        if (!isALProject()) {
            vscode.window.showErrorMessage('This is not an AL project. Please open an AL project.');
            outputChannel.appendLine('Project is not an AL project...');
            outputChannel.appendLine('Deployment process finished.');
            throw new Error('Project is not an AL project');
        }
        outputChannel.appendLine('Project is an AL project...');
        outputChannel.appendLine('Building the solution...');

        // Build the solution using the provided build function
        const builtSuccessfully = await buildFunction();
        if (!builtSuccessfully) {
            vscode.window.showErrorMessage('Failed to build the solution.');
            outputChannel.appendLine('Failed to build the solution...');
            throw new Error('Failed to build the solution');
        }

        outputChannel.appendLine('Solution built successfully...');
        outputChannel.appendLine('Getting available environments...');
        // Ensure your output channel is shown again after build

        // Get available environments from launch.json
        const environments = await getEnvironmentsFromLaunchJson(outputChannel);

        if (environments.length === 0) {
            vscode.window.showErrorMessage('No Business Central environments found in launch.json.');
            outputChannel.appendLine('No Business Central environments found in launch.json...');
            throw new Error('No Business Central environments found in launch.json');
        }

        // If multiple environments, let user choose
        let selectedEnvironment: BusinessCentralEnvironment;
        let authConfig: BCAuth;

        if (environments.length === 1) {
            selectedEnvironment = environments[0];
        } else {
            const environmentItems = environments.map((env, index) => ({
                label: `${env.name}`,
                detail: env.config.environmentName,
                index: index
            }));

            await new Promise(resolve => setTimeout(resolve, 100));
            const selectedItem = await vscode.window.showQuickPick(environmentItems, {
                placeHolder: 'Select Business Central environment to deploy to'
            });

            if (!selectedItem) {
                outputChannel.appendLine('User cancelled the deployment...');
                outputChannel.show(true);
                return; // User cancelled
            }

            selectedEnvironment = environments[selectedItem.index];
            outputChannel.appendLine(`Selected environment: ${selectedEnvironment.name}...`);
        }
        outputChannel.show(true);
        await new Promise(resolve => setTimeout(resolve, 100));
        // use the selected environment to get client ID and secret
        authConfig = {
            tenantId: selectedEnvironment.config.tenant || '',
            clientId: selectedEnvironment.config.clientID || '',
            clientSecret: selectedEnvironment.config.clientSecret || '',
            scope: 'https://api.businesscentral.dynamics.com/.default',
            tokenUrl: `https://login.microsoftonline.com/${selectedEnvironment.config.tenant}/oauth2/v2.0/token`
        };

        if (authConfig.clientId == '' || authConfig.clientSecret == '' || authConfig.tenantId == '') {
            vscode.window.showErrorMessage('Client ID, Client Secret or Tenant ID is missing in launch.json');
            outputChannel.appendLine('Client ID, Client Secret or Tenant ID is missing in launch.json...');
            throw new Error('Client ID, Client Secret or Tenant ID is missing in launch.json')
        }

        outputChannel.appendLine('Client ID, Client Secret and Tenant ID found in launch.json...');
        outputChannel.appendLine('Starting deployment as PTE...');
        // Find the .app file to deploy
        const appFile = findAppFile();
        if (!appFile) {
            vscode.window.showErrorMessage('Could not find compiled .app file.');
            outputChannel.appendLine('Could not find compiled .app file...');
            throw new Error('Could not find compiled .app file.');
        }

        outputChannel.appendLine(`Found app file: ${appFile}...
        Deploying to ${selectedEnvironment.name} as PTE...`);

        // Deploy as PTE
        await deployAsPTE(appFile, selectedEnvironment.config, authConfig, outputChannel);

        vscode.window.showInformationMessage(`Successfully deployed to ${selectedEnvironment.name} as PTE.`);
    } catch (error) {
        console.error(error);
        vscode.window.showErrorMessage(`Deployment failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// Build the AL solution with increment
async function buildSolutionWithIncrement(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Building AL Solution with Increment',
            cancellable: false
        }, async (progress) => {
            try {
                // Logic to increment version before building
                progress.report({ message: 'Incrementing version...' });
                await incrementVersion();

                // Execute the AL Language extension's build command
                progress.report({ message: 'Building solution...' });
                await vscode.commands.executeCommand('al.package');

                progress.report({ message: 'Build completed' });
                resolve(true);
            } catch (error) {
                console.error('Build with increment failed:', error);
                resolve(false);
            }
        });
    });
}

// Increment version logic
async function incrementVersion(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('No workspace folder found.');
    }

    const appJsonPath = path.join(workspaceFolders[0].uri.fsPath, 'app.json');
    if (!fs.existsSync(appJsonPath)) {
        throw new Error('app.json not found.');
    }

    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    if (!appJson.version) {
        throw new Error('Version not found in app.json.');
    }

    const versionParts = appJson.version.split('.');
    if (versionParts.length !== 4) {
        throw new Error('Invalid version format in app.json.');
    }

    const incrementVersionConfig = vscode.workspace.getConfiguration('bc-pte-deployment').get<string>('incrementVersion');
    switch (incrementVersionConfig) {
        case 'major':
            versionParts[0] = (parseInt(versionParts[0]) + 1).toString();
            versionParts[1] = '0';
            versionParts[2] = '0';
            versionParts[3] = '0';
            break;
        case 'minor':
            versionParts[1] = (parseInt(versionParts[1]) + 1).toString();
            versionParts[2] = '0';
            versionParts[3] = '0';
            break;
        case 'build':
            versionParts[2] = (parseInt(versionParts[2]) + 1).toString();
            versionParts[3] = '0';
            break;
        case 'revision':
            versionParts[3] = (parseInt(versionParts[3]) + 1).toString();
            break;
        default:
            vscode.window.showErrorMessage('Invalid increment version configuration. Please check your settings.'); 
            throw new Error('Invalid increment version configuration. Please check your settings.');
    }

    appJson.version = versionParts.join('.');

    fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 4), 'utf8');
}

export function registerGetDeploymentStatusCommand(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
    const statusCommand = vscode.commands.registerCommand('bc-pte-deployment.getDeploymentStatus', async () => {
        try {
            outputChannel.clear();
            outputChannel.appendLine('Fetching deployment status...');
            outputChannel.show(true);
            await new Promise(resolve => setTimeout(resolve, 100));
            // Check if we're in an AL project
            outputChannel.appendLine('Checking if the project is an AL project...');
            if (!isALProject()) {
                vscode.window.showErrorMessage('This is not an AL project. Please open an AL project.');
                outputChannel.appendLine('Project is not an AL project...');
                outputChannel.appendLine('Deployment process finished.');
                throw new Error('Project is not an AL project');
            }
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showErrorMessage('No workspace folder found.');
                outputChannel.appendLine('No workspace folder found...');
                throw new Error('No workspace folder found.');
            }

            // Get available environments from launch.json
            const environments = await getEnvironmentsFromLaunchJson(outputChannel);
            if (environments.length === 0) {
                vscode.window.showErrorMessage('No Business Central environments found in launch.json.');
                outputChannel.appendLine('No Business Central environments found in launch.json...');
                throw new Error('No Business Central environments found in launch.json');
            }

            // If multiple environments, let user choose
            let selectedEnvironment: BusinessCentralEnvironment;
            if (environments.length === 1) {
                selectedEnvironment = environments[0];
            } else {
                const environmentItems = environments.map((env, index) => ({
                    label: `${env.name}`,
                    detail: env.config.environmentName,
                    index: index
                }));

                await new Promise(resolve => setTimeout(resolve, 100));
                const selectedItem = await vscode.window.showQuickPick(environmentItems, {
                    placeHolder: 'Select Business Central environment to check deployment status'
                });

                if (!selectedItem) {
                    outputChannel.appendLine('User cancelled the operation...');
                    return; // User cancelled
                }
                selectedEnvironment = environments[selectedItem.index];
            }

            const authConfig: BCAuth = {
                tenantId: selectedEnvironment.config.tenant || '',
                clientId: selectedEnvironment.config.clientID || '',
                clientSecret: selectedEnvironment.config.clientSecret || '',
                scope: 'https://api.businesscentral.dynamics.com/.default',
                tokenUrl: `https://login.microsoftonline.com/${selectedEnvironment.config.tenant}/oauth2/v2.0/token`
            };

            if (!authConfig.clientId || !authConfig.clientSecret || !authConfig.tenantId) {
                vscode.window.showErrorMessage('Client ID, Client Secret, or Tenant ID is missing in launch.json.');
                outputChannel.appendLine('Client ID, Client Secret, or Tenant ID is missing in launch.json...');
                throw new Error('Client ID, Client Secret, or Tenant ID is missing in launch.json');
            }

            let appName = '';
            let version = '';
            let publisher = '';
            ({ appName, version, publisher } = findAppJsonInfo(workspaceFolders, appName, version, publisher));

            const authToken = await getBusinessCentralToken(authConfig, outputChannel);
            const companyId = await getBusinessCentralCompanyId(selectedEnvironment.config.environmentName!, authToken, outputChannel, selectedEnvironment.config.companyName);

            const statusUrl = `https://api.businesscentral.dynamics.com/v2.0/${selectedEnvironment.config.environmentName}/api/microsoft/automation/v2.0/companies(${companyId})/extensionDeploymentStatus?$top=10`;
            // Only fetch the top 10 statuses

            const response = await axios.get(statusUrl, {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Accept': 'application/json'
                }
            });

            // Filter data where the app name, version, and publisher match
            const filteredStatus = response.data.value.filter((status: any) => {
                return status.name === appName && status.appVersion === version && status.publisher === publisher;
            }
            );
            // const status = response.data;
            if (filteredStatus.length === 0) {
                vscode.window.showInformationMessage('No deployment status found for the current app.');
                outputChannel.appendLine('No deployment status found for the current app...');
                return;
            }
            outputChannel.appendLine('Deployment Status:');
            // colocar no output channel Name, AppVersion, Publisher, Status, Message
            filteredStatus.forEach((status: any) => {
                outputChannel.appendLine(`Environment: ${selectedEnvironment.config.environmentName} - Name: ${status.name} - AppVersion: ${status.appVersion} - Publisher: ${status.publisher} - Status: ${status.status}`);
            });
            vscode.window.showInformationMessage('Deployment status fetched successfully. Check the output channel for details.');
        } catch (error) {
            console.error('Failed to fetch deployment status:', error);
            vscode.window.showErrorMessage(`Failed to fetch deployment status: ${error instanceof Error ? error.message : String(error)}`);
        }
    });

    context.subscriptions.push(statusCommand);
}


// Check if the current project is an AL project
function isALProject(): boolean {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return false;
    }

    const appJsonPath = path.join(workspaceFolders[0].uri.fsPath, 'app.json');
    return fs.existsSync(appJsonPath);
}

// Build the AL solution
async function buildSolution(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Building AL Solution',
            cancellable: false
        }, async (progress) => {
            try {
                // Execute the AL Language extension's build command
                await vscode.commands.executeCommand('al.package');

                progress.report({ message: 'Build completed' });
                resolve(true);
            } catch (error) {
                console.error('Build failed:', error);
                resolve(false);
            }
        });
    });
}

// Read environments from launch.json
async function getEnvironmentsFromLaunchJson(outputChannel: vscode.OutputChannel): Promise<BusinessCentralEnvironment[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        return [];
    }

    const launchJsonPath = path.join(workspaceFolders[0].uri.fsPath, '.vscode', 'launch.json');

    if (!fs.existsSync(launchJsonPath)) {
        return [];
    }

    try {
        let launchJsonContent = fs.readFileSync(launchJsonPath, 'utf8');

        // Remove trailing commas to handle invalid JSON
        launchJsonContent = launchJsonContent.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

        const launchJson = JSON.parse(launchJsonContent);

        if (!launchJson.configurations || !Array.isArray(launchJson.configurations)) {
            return [];
        }

        // Filter for AL configurations with clientId and clientSecret defined
        const alConfigs = launchJson.configurations.filter((config: any) =>
            config.type === 'PTE' && config.request === 'AL PTE Publish'
        );

        return alConfigs.map((config: LaunchConfig) => ({
            name: config.name,
            config: config
        }));
    } catch (error) {
        console.error('Error reading launch.json:', error);
        outputChannel.appendLine('Error reading launch.json: ' + error);
        throw new Error('Could not parse launch.json');
    }
}

// Find the compiled app file
function findAppFile(): string | null {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        return null;
    }

    // Read app.json to get the app name for more accurate matching
    let appName = '';
    let version = '';
    let publisher = '';
    try {
        ({ appName, version, publisher } = findAppJsonInfo(workspaceFolders, appName, version, publisher));
    } catch (error) {
        console.warn('Could not read app.json:', error);
    }

    return path.join(workspaceFolders[0].uri.fsPath, `${publisher}_${appName}_${version}.app`);
    // TODO se existir uma conf diferente para a pasta de output do app, tem que ser alterado, como validar isso?

}


function findAppJsonInfo(workspaceFolders: readonly vscode.WorkspaceFolder[], appName: string, version: string, publisher: string) {
    const appJsonPath = path.join(workspaceFolders[0].uri.fsPath, 'app.json');
    if (fs.existsSync(appJsonPath)) {
        const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
        appName = appJson.name || '';
        version = appJson.version || '';
        publisher = appJson.publisher || '';
    }
    return { appName, version, publisher };
}

// Deploy as PTE to Business Central
async function deployAsPTE(
    appFilePath: string,
    config: LaunchConfig,
    authConfig: BCAuth,
    outputChannel: vscode.OutputChannel
): Promise<void> {
    // Extract environment name from launch.json
    let environmentName = config.environmentName || '';

    if (!environmentName) {
        // Prompt user for environment name
        environmentName = await vscode.window.showInputBox({
            prompt: 'Enter Business Central environment name',
            placeHolder: 'e.g. production, sandbox, etc.'
        }) || '';

        if (!environmentName) {
            outputChannel.appendLine('Environment name is required...');
            throw new Error('Environment name is required');
        }
    }

    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Deploying to ${environmentName} as PTE`,
        cancellable: false,
    }, async (progress) => {
        try {
            // Step 1: Get auth token
            progress.report({ message: 'Authenticating with Business Central...' });
            const authToken = await getBusinessCentralToken(authConfig, outputChannel);

            // Step 2: Publish app
            progress.report({ message: 'Uploading app...' });
            await uploadAppToBusinessCentral(appFilePath, environmentName, authToken, outputChannel, config.companyName);
            outputChannel.appendLine('App uploaded successfully...');

            // Step 3: Show message to user
            // App esta siendo instalada, para mas informacion ver en el extension management o usar el comando Get Extension Deployment Status
            vscode.window.showInformationMessage(`App is being installed in ${environmentName}.`);
            outputChannel.appendLine('App is being installed, for more information check the extension management or use the command Get Extension Deployment Status');
            return;
        } catch (error) {
            console.error('Deployment failed:', error);
            outputChannel.appendLine('Deployment failed: ' + error);
            throw error;
        }
    });
}

// Get auth token for Business Central
async function getBusinessCentralToken(authConfig: BCAuth, outputChannel: vscode.OutputChannel): Promise<string> {
    try {
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');
        params.append('client_id', authConfig.clientId);
        params.append('client_secret', authConfig.clientSecret);
        params.append('scope', authConfig.scope);

        const response = await axios.post<AuthToken>(authConfig.tokenUrl, params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        return response.data.access_token;
    } catch (error) {
        console.error('Authentication failed:', error);
        outputChannel.appendLine('Authentication failed: ' + error);
        outputChannel.appendLine('Failed to authenticate with Business Central...');
        throw new Error('Failed to authenticate with Business Central');
    }
}

// Upload app to Business Central
async function uploadAppToBusinessCentral(
    appFilePath: string,
    environmentName: string,
    authToken: string,
    outputChannel: vscode.OutputChannel,
    companyName?: string
): Promise<void> {
    try {
        // Get the BC company ID
        const companyId = await getBusinessCentralCompanyId(environmentName, authToken, outputChannel, companyName);

        // Upload the app
        const url = `https://api.businesscentral.dynamics.com/v2.0/${environmentName}/api/microsoft/automation/v1.0/companies(${companyId})/extensionUpload(0)/content`;

        // Read the app file
        const fileContent = fs.readFileSync(appFilePath);
        if (!fileContent || fileContent.length === 0) {
            throw new Error("App file is empty.");
        }

        const response = await axios.patch(url, fileContent, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'if-Match': '*',
                'Content-Type': 'application/octet-stream'
            }
        });

        // Verificar el resultado
        if (response.status !== 204) {
            outputChannel.appendLine(`Unexpected status code: ${response.status}`);
            throw new Error(`Unexpected status code: ${response.status}`);
        }

        console.log('App uploaded successfully');

    } catch (error: any) {
        console.error('Upload failed:', error);
        outputChannel.appendLine('Upload failed: ' + error);

        if (error.response) {
            console.error('Error data:', error.response.data);
            console.error('Error status:', error.response.status);
            console.error('Error headers:', error.response.headers);
        }
        outputChannel.appendLine('Failed to upload app to Business Central: ' + error.message);
        throw new Error(`Failed to upload app to Business Central: ${error.message}`);
    }
}

// Get Business Central company ID
async function getBusinessCentralCompanyId(
    environmentName: string,
    authToken: string,
    outputChannel: vscode.OutputChannel,
    companyName?: string
): Promise<string> {
    try {
        let url = `https://api.businesscentral.dynamics.com/v2.0/${environmentName}/api/microsoft/automation/v1.0/companies`;
        if (companyName) {
            url += `?$filter=name eq '${companyName}'`;
        }

        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Accept': 'application/json'
            }
        });

        const companies = response.data.value;

        if (!companies || companies.length === 0) {
            outputChannel.appendLine('No companies found in Business Central environment...');
            throw new Error('No companies found in Business Central environment');
        }

        return companies[0].id;
    } catch (error) {
        console.error('Failed to get company ID:', error);
        outputChannel.appendLine('Failed to get company ID: ' + error);
        outputChannel.appendLine('Failed to get company ID from Business Central...');
        throw new Error('Failed to get company ID from Business Central');
    }
}