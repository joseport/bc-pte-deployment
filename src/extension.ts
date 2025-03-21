// TODO Agregar um comando para ver o status do deployment, se o app esta instalado ou não e se tem erro ou não igual ao que ja existe mas repetindo o comando até acabar ou sucesso ou failed e mostarr num popup

import * as vscode from 'vscode';
import { registerDeployCommand, registerDeployWithIncrementCommand, registerGetDeploymentStatusCommand } from './commands';


export function activate(context: vscode.ExtensionContext) {
	
	const outputChannel = vscode.window.createOutputChannel('PTE Deployment');

    // Register commands
    registerDeployCommand(context, outputChannel);
    registerDeployWithIncrementCommand(context, outputChannel);
    registerGetDeploymentStatusCommand(context, outputChannel);
}


export function deactivate() {}