import * as vscode from "vscode";

export class SelectOrganizationTreeProvider implements vscode.TreeDataProvider<OrganizationItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<undefined> = new vscode.EventEmitter<undefined>();
    readonly onDidChangeTreeData: vscode.Event<undefined> = this._onDidChangeTreeData.event;

    private selectedOrganizationId = null;
    private organizations = [];

    constructor(organizations, selectedOrganizationId) {
        this.organizations = organizations || [];
        this.selectedOrganizationId = selectedOrganizationId || null;
        this.refresh();
    }

    setOrganizations(organizations) {
        this.organizations = organizations;
        this.refresh();
    }

    setOrganizationId(organizationId) {
        this.selectedOrganizationId = organizationId;
        this.refresh();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: any): vscode.TreeItem {
        return element;
    }

    async getChildren(element) {
        if (element) {
            return null
        }

        const isValidOrganizationId = !!this.selectedOrganizationId || this.organizations.some(organization => organization.id === this.selectedOrganizationId)

        return [
            new OrganizationItem('None (publicly)', null, !isValidOrganizationId),
            ...this.organizations.map(org => new OrganizationItem(org.username, org.id, this.selectedOrganizationId === org.id))
        ]
    }
}

export class OrganizationItem extends vscode.TreeItem {
    private readonly isSelected: boolean;
    constructor(organizationUsername: string, organizationId: string, isSelected: boolean) {
        const emoji = isSelected ? '☑️' : '';
        const label = `${emoji} ${organizationUsername}`;
        super(label, vscode.TreeItemCollapsibleState.None);

        this.isSelected = isSelected;
        this.command = {
            command: 'gitduck.setActiveTeam',
            title: '',
            arguments: [organizationId]
        }
    }

    get description(): string {
        if (this.isSelected) {
            return 'Selected';
        }
        return '';
    }

}
