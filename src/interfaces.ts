// Define interfaces for typing
export interface LaunchConfig {
    type: string;
    request: string;
    name: string;
    tenant: string;
    environmentName: string;
    companyName?: string;
    clientID: string;
    clientSecret: string;
}

export interface BusinessCentralEnvironment {
    name: string;
    config: LaunchConfig;
}

export interface BCAuth {
    tenantId: string;
    clientId: string;
    clientSecret: string;
    tokenUrl: string;
    scope: string;
}

export interface AuthToken {
    access_token: string;
    expires_in: number;
    token_type: string;
}