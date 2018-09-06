import React from 'react';
import LoadingMask from 'd2-ui/lib/loading-mask/LoadingMask.component';
import TextField from 'material-ui/TextField/TextField';
import Action from 'd2-ui/lib/action/Action';
import { Observable } from 'rxjs/Rx';
import OrgUnitTree from 'd2-ui/lib/org-unit-tree/OrgUnitTree.component';
import OrgUnitSelectByLevel from 'd2-ui/lib/org-unit-select/OrgUnitSelectByLevel.component';
import OrgUnitSelectByGroup from 'd2-ui/lib/org-unit-select/OrgUnitSelectByGroup.component';
import OrgUnitSelectAll from 'd2-ui/lib/org-unit-select/OrgUnitSelectAll.component';
import PropTypes from 'prop-types';

class OrgUnitForm extends React.Component {
    constructor(props, context) {
        super(props, context);

        this.state = {
            searchValue: '',
            originalRoots: this.props.roots,
            rootOrgUnits: this.props.roots,
            groups: [],
            levels: [],
            loading: false,
        };

        this._searchOrganisationUnits = Action.create('searchOrganisationUnits');
        this.getTranslation = context.d2.i18n.getTranslation.bind(context.d2.i18n);
        this.toggleOrgUnit = this.toggleOrgUnit.bind(this);
        this.onChange = this.onChange.bind(this);
    }

    componentWillMount() {
        const d2 = this.context.d2;

        Promise.all([
            d2.models.organisationUnitLevels.list({
                paging: false,
                fields: 'id,level,displayName,path',
                order: 'level:asc',
            }),
            d2.models.organisationUnitGroups.list({
                paging: false,
                fields: 'id,displayName,path',
            }),
        ])
            .then(([
                levels,
                groups,
            ]) => {
                this.setState({
                    groups,
                    levels
                });
            });

        this.disposable = this._searchOrganisationUnits
            .map(action => action.data)
            .debounceTime(400)
            .distinctUntilChanged()
            .map(searchValue => {
                if (!searchValue.trim()) {
                    return Observable.of(this.state.originalRoots);
                } else {
                    const organisationUnitRequest = this.context.d2.models.organisationUnits
                        .filter().on('displayName').ilike(searchValue)
                        .list({ fields: 'id,displayName,path,children::isNotEmpty', withinUserHierarchy: true })
                        .then(modelCollection => modelCollection.toArray());
                    return Observable.fromPromise(organisationUnitRequest);
                }
            })
            .concatAll()
            .subscribe((orgUnits) => {
                this.setState({ rootOrgUnits: orgUnits });
            });
    }

    componentWillUnmount() {
        this.disposable && this.disposable.unsubscribe();
    }

    onChange(orgUnitsPaths) {
        this.props.onChange(orgUnitsPaths);
    }

    toggleOrgUnit(ev, orgUnit) {
        const newSelected = _(this.props.selected).find(path => path === orgUnit.path)
            ? this.props.selected.filter(path => path !== orgUnit.path)
            : this.props.selected.concat([orgUnit.path]);
        this.props.onChange(newSelected);
    }

    renderRoots() {
        const selectedPaths = this.props.selected;

        if (this.state.rootOrgUnits.length) {
            return (
                <div style={{ maxHeight: 350, maxWidth: 480, overflow: 'auto' }}>
                    {this.state.rootOrgUnits.map(rootOu => (
                        <OrgUnitTree
                            key={rootOu.id}
                            selected={selectedPaths}
                            root={rootOu}
                            onSelectClick={this.toggleOrgUnit}
                            emitModel
                            initiallyExpanded={[rootOu.path]}
                        />
                    ))}
                </div>
            );
        }

        return (
            <div>{this.context.d2.i18n.getTranslation('no_roots_found')}</div>
        );
    }

    render() {
        if (!this.state.rootOrgUnits) {
            return (<div>this.context.d2.i18n.getTranslation('determining_your_root_orgunits')</div>);
        }

        const { root, models, intersectionPolicy } = this.props;
        const styles = {
            wrapper: {
                position: 'relative',
                height: 450, minHeight: 450, maxHeight: 450,
                minWidth: 800,
            },
            loadingMask: {
                position: 'fixed',
                top: 54, right: 22,
                width: 480,
                height: 250,
                background: 'rgba(255,255,255,0.6)',
                zIndex: 5,
            },
            controls: {
                position: 'fixed',
                top: 156, right: 24,
                width: 475,
                zIndex: 1,
                background: 'white',
            },
        };

        const selectedPaths = this.props.selected;

        return (
            <div style={styles.wrapper}>
                {this.state.loading ? (
                    <div style={styles.loadingMask}>
                        <LoadingMask />
                    </div>
                ) : undefined}

                <TextField
                    onChange={(event) => this._searchOrganisationUnits(event.target.value)}
                    floatingLabelText={this.context.d2.i18n.getTranslation('filter_organisation_units_by_name')}
                    fullWidth
                />

                <div style={styles.controls}>
                    <OrgUnitSelectByGroup
                        groups={this.state.groups}
                        selected={selectedPaths}
                        intersectionPolicy={intersectionPolicy}
                        onUpdateSelection={this.onChange}
                    />
                    <OrgUnitSelectByLevel
                        levels={this.state.levels}
                        selected={selectedPaths}
                        intersectionPolicy={intersectionPolicy}
                        onUpdateSelection={this.onChange}
                    />
                    <div style={{ marginTop: 16 }}>
                        <OrgUnitSelectAll
                            selected={selectedPaths}
                            onUpdateSelection={this.onChange}
                        />
                    </div>
                </div>
                <div className="organisation-unit-tree__selected">
                    {`${this.props.selected.length} ${this.getTranslation('organisation_units_selected')}`}
                </div>
                {this.renderRoots()}
            </div>
        );
    }
}

OrgUnitForm.propTypes = {
    onChange: PropTypes.func.isRequired,
    roots: PropTypes.arrayOf(PropTypes.object).isRequired,
    selected: PropTypes.arrayOf(PropTypes.string).isRequired,
    intersectionPolicy: PropTypes.bool,
};

OrgUnitForm.defaultProps = {
    intersectionPolicy: false,
};

OrgUnitForm.contextTypes = {
    d2: PropTypes.any,
};

export default OrgUnitForm;