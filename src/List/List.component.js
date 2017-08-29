import React, { Component } from 'react';
import log from 'loglevel';
import isIterable from 'd2-utilizr/lib/isIterable';
import DataTable from 'd2-ui/lib/data-table/DataTable.component';
import Pagination from 'd2-ui/lib/pagination/Pagination.component';
import DetailsBox from './DetailsBox.component';
import contextActions from './ContextActions';
import detailsStore from './details.store';
import listStore from './list.store';
import listActions from './list.actions';
import ObserverRegistry from '../utils/ObserverRegistry.mixin';
import Paper from 'material-ui/Paper/Paper';
import Translate from 'd2-ui/lib/i18n/Translate.mixin';
import SearchBox from './SearchBox.component';
import LoadingStatus from './LoadingStatus.component';
import camelCaseToUnderscores from 'd2-utilizr/lib/camelCaseToUnderscores';
import Auth from 'd2-ui/lib/auth/Auth.mixin';
import orgUnitDialogStore from './organisation-unit-dialog/organisationUnitDialogStore';
import OrgUnitDialog from './organisation-unit-dialog/OrgUnitDialog.component';
import snackActions from '../Snackbar/snack.actions';
import Heading from 'd2-ui/lib/headings/Heading.component';
import Checkbox from 'material-ui/Checkbox/Checkbox';
import { Observable } from 'rx';
import PropTypes from 'prop-types';

// Filters out any actions `edit`, `clone` when the user can not update/edit this modelType
function actionsThatRequireCreate(action) {
    if ((action !== 'edit' && action !== 'clone') || this.getCurrentUser().canUpdate(this.getModelDefinitionByName(this.props.params.modelType))) {
        return true;
    }
    return false;
}

// Filters out the `delete` when the user can not delete this modelType
function actionsThatRequireDelete(action) {
    if (action !== 'delete' || this.getCurrentUser().canDelete(this.getModelDefinitionByName(this.props.params.modelType))) {
        return true;
    }
    return false;
}

// TODO: Move this somewhere as a utility function, probably on the Pagination component (as a separate export) in d2-ui?
export function calculatePageValue(pager) {
    const pageSize = 50; // TODO: Make the page size dynamic
    const { total, pageCount, page } = pager;
    const pageCalculationValue = total - (total - ((pageCount - (pageCount - page)) * pageSize));
    const startItem = 1 + pageCalculationValue - pageSize;
    const endItem = pageCalculationValue;

    return `${startItem} - ${endItem > total ? total : endItem}`;
}

class DetailsBoxWithScroll extends Component {

    componentDidMount() {
        this.disposable = Observable
            .fromEvent(global, 'scroll')
            .debounce(200)
            .map(() => document.querySelector('body').scrollTop)
            .subscribe(() => this.forceUpdate());
    }

    componentWillUnmount() {
        this.disposable && this.disposable.dispose();
    }

    render() {
        return (
            <div style={this.props.style}>
                <Paper zDepth={1} rounded={false} style={{ maxWidth: 500, minWidth: 300, marginTop: document.querySelector('body').scrollTop }}>
                    <DetailsBox
                        source={this.props.detailsObject}
                        showDetailBox={!!this.props.detailsObject}
                        onClose={this.props.onClose}
                    />
                </Paper>
            </div>
        );
    }
}

const List = React.createClass({
    propTypes: {
        params: PropTypes.shape({
            modelType: PropTypes.string.isRequired,
        }),
    },

    mixins: [ObserverRegistry, Translate, Auth],

    getInitialState() {
        return {
            dataRows: [],
            pager: {
                total: 0,
            },
            isLoading: true,
            detailsObject: null,
            searchString: "",
            showAllUsers: true,
            sharing: {
                model: null,
                open: false,
            },
            translation: {
                model: null,
                open: false,
            },
            orgunitassignment: {
                model: null,
                roots: [],
                open: false,
            },
            dataElementOperand: {
                model: null,
                open: false,
            },
        };
    },

    componentWillMount() {
        const sourceStoreDisposable = listStore
            .subscribe(listStoreValue => {
                if (!isIterable(listStoreValue.list)) {
                    return; // Received value is not iterable, keep waiting
                }

                this.setState({
                    dataRows: listStoreValue.list,
                    pager: listStoreValue.pager,
                    tableColumns: listStoreValue.tableColumns,
                    isLoading: false,
                });
            });

        const detailsStoreDisposable = detailsStore.subscribe(detailsObject => {
            this.setState({ detailsObject });
        });

        const orgUnitAssignmentStoreDisposable = orgUnitDialogStore.subscribe(orgunitassignmentState => {
            this.setState({
                orgunitassignment: orgunitassignmentState,
            });
        });

        this.registerDisposable(sourceStoreDisposable);
        this.registerDisposable(detailsStoreDisposable);
        this.registerDisposable(orgUnitAssignmentStoreDisposable);
    },

    componentWillReceiveProps(newProps) {
        if (this.props.params.modelType !== newProps.params.modelType) {
            this.setState({
                isLoading: true,
                translation: Object.assign({}, this.state.translation, { open: false }),
            });
        }
    },

    _orgUnitAssignmentSaved() {
        snackActions.show({ message: 'organisation_unit_assignment_saved', action: 'ok', translate: true });
    },

    _orgUnitAssignmentError(errorMessage) {
        log.error(errorMessage);
        snackActions.show({ message: 'organisation_unit_assignment_save_error', translate: true });
    },

    isContextActionAllowed(model, action) {
        // Don't allow anything if we can't determine the access
        if (!model || !model.access) {
            return false;
        }

        // TODO: Remove categoryOptionCombo available actions hack when this is sorted through the API
        if (model.modelDefinition.name === 'categoryOptionCombo') {
            if (action === 'edit') {
                return model.access.write;
            }

            if (action === 'details') {
                return model.access.read;
            }

            return false;
        }

        // Shortcut for access detection where action names match to access properties
        if (model.access.hasOwnProperty(action)) {
            return model.access[action];
        }

        // Switch action for special cases
        switch (action) {
        case 'details':
            return model.access.read;
        case 'assignToOrgUnits':
            return model.modelDefinition.name === 'user' && model.access.write;
        default:
            return true;
        }
    },

    searchListByName(searchObserver) {
        const searchListByNameDisposable = searchObserver
            .subscribe((value) => {
                this.setState({
                    isLoading: true,
                    searchString: value,
                });

                listActions.filter({
                        modelType: this.props.params.modelType,
                        searchString: value,
                        canManage: !this.state.showAllUsers,
                    })
                    .subscribe(() => {}, (error) => log.error(error));
            });

        this.registerDisposable(searchListByNameDisposable);
    },

    _onCanManageClick(ev, isChecked) {
        listActions.filter({
            modelType: this.props.params.modelType,
            searchString: this.state.searchString,
            canManage: isChecked,
        });

        this.setState({showAllUsers: !isChecked});
    },

    render() {
        const currentlyShown = calculatePageValue(this.state.pager);

        const paginationProps = {
            hasNextPage: () => Boolean(this.state.pager.hasNextPage) && this.state.pager.hasNextPage(),
            hasPreviousPage: () => Boolean(this.state.pager.hasPreviousPage) && this.state.pager.hasPreviousPage(),
            onNextPageClick: () => {
                this.setState({ isLoading: true });
                listActions.getNextPage();
            },
            onPreviousPageClick: () => {
                this.setState({ isLoading: true });
                listActions.getPreviousPage();
            },
            total: this.state.pager.total,
            currentlyShown,
        };

        const availableActions = Object.keys(contextActions)
            .filter(actionsThatRequireCreate, this)
            .filter(actionsThatRequireDelete, this)
            .reduce((actions, actionName) => {
                // TODO: Don't re-assign param?
                actions[actionName] = contextActions[actionName]; // eslint-disable-line no-param-reassign
                return actions;
            }, {});

        const styles = {
            dataTableWrap: {
                display: 'flex',
                flexDirection: 'column',
                flex: 2,
            },

            detailsBoxWrap: {
                flex: 1,
                marginLeft: '1rem',
                marginRight: '1rem',
                opacity: 1,
                flexGrow: 0,
            },

            listDetailsWrap: {
                flex: 1,
                display: 'flex',
                flexOrientation: 'row',
            },
        };

        const contextMenuIcons = {
            assignToOrgUnits: 'business',
        };

        return (
            <div>
                <div>
                    <Heading>{this.getTranslation(`${camelCaseToUnderscores(this.props.params.modelType)}_management`)}</Heading>                    
                </div>
                <div>
                    <div style={{ float: 'left', width: '30%' }}>
                        <SearchBox searchObserverHandler={this.searchListByName}/>
                    </div>
                    <div style={{ float: 'left', width: '30%', marginTop: 10, marginLeft: 5 }}>
                        <Checkbox
                            label={this.getTranslation('display_only_users_can_manage')}
                            onCheck={this._onCanManageClick}
                            checked={!this.state.showAllUsers}
                        />
                    </div>
                    <div>
                        <Pagination {...paginationProps} />
                    </div>
                </div>
                <LoadingStatus
                    loadingText={['Loading', this.props.params.modelType, 'list...'].join(' ')}
                    isLoading={this.state.isLoading}
                />
                <div style={styles.listDetailsWrap}>
                    <div style={styles.dataTableWrap}>
                        <DataTable
                            rows={this.state.dataRows}
                            columns={this.state.tableColumns}
                            contextMenuActions={availableActions}
                            contextMenuIcons={contextMenuIcons}
                            primaryAction={(user, ev) => availableActions.assignToOrgUnits(user)}
                            isContextActionAllowed={this.isContextActionAllowed}
                        />
                        {this.state.dataRows.length || this.state.isLoading ? null : <div>No results found</div>}
                    </div>
                    {
                        this.state.detailsObject ?
                            <DetailsBoxWithScroll
                                style={styles.detailsBoxWrap}
                                detailsObject={this.state.detailsObject}
                                onClose={listActions.hideDetailsBox}
                            />
                        : null}
                </div>

                {this.state.orgunitassignment.model ? <OrgUnitDialog
                    model={this.state.orgunitassignment.model}
                    roots={this.state.orgunitassignment.roots}
                    open={this.state.orgunitassignment.open}
                    onOrgUnitAssignmentSaved={this._orgUnitAssignmentSaved}
                    onOrgUnitAssignmentError={this._orgUnitAssignmentError}
                    onRequestClose={this._closeOrgUnitDialog}
                /> : null }
            </div>
        );
    },

    _closeOrgUnitDialog() {
        orgUnitDialogStore.setState(Object.assign({}, orgUnitDialogStore.state, {
            open: false,
        }));
    },

});

export default List;
