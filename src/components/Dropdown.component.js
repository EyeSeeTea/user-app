import React from 'react';
import SelectField from 'material-ui/SelectField/SelectField';
import TextField from 'material-ui/TextField';
import isString from 'd2-utilizr/lib/isString';
import Dialog from 'material-ui/Dialog';
import FlatButton from 'material-ui/FlatButton';
import MenuItem from 'material-ui/MenuItem/MenuItem';

/* Selector wrapper.
   When options.length < props.limit -> show a normal SelectField,
   otherwise -> show a dialog with a list of selectable options and a text filter */

class Dropdown extends React.Component {
    constructor(props, context) {
        super(props, context);

        this.getTranslation = context.d2.i18n.getTranslation.bind(context.d2.i18n);
        this._onChange = this._onChange.bind(this);
        this.openDialog = this.openDialog.bind(this);
        this.closeDialog = this.closeDialog.bind(this);

        this.state = {
            value: (this.props.value !== undefined && this.props.value !== null) ? this.props.value : '',
            options: this.getOptions(this.props.options, this.props.isRequired),
            dialogOpen: false,
        };
    }

    componentWillReceiveProps(newProps) {
        this.setState({
            options: this.getOptions(newProps.options, newProps.isRequired),
        });
    }

    getOptions(options, required = false) {
        let opts = options
            .map((option) => {
                return {
                    value: option.value,
                    text: option.text,
                };
            });

        return opts
            .map(option => {
                if (option.text && this.props.translateOptions) {
                    option.text = isString(option.text) ? this.getTranslation(option.text.toLowerCase()) : option.text;
                }
                return option;
            });
    }

    _onChange(event, index, value) {
        this.props.onChange({
            target: {
                value,
            }
        });
    }

    openDialog() {
        this.setState({ dialogOpen: true, filterText: '' });
    }

    closeDialog() {
        this.setState({ dialogOpen: false });
    }

    getOptionText(value) {
        return value && this.state.options.length
            ? this.state.options.find(option => option.value === value).text
            : '';
    }

    renderDialogOption(value, label) {
        return (
            <div
            style={{ cursor: 'pointer', margin: 8 }}
            key={value}
            onClick={() => {
                this.props.onChange({ target: { value: value } });
                this.setState({ dialogOpen: false, value: value });
            }}
            ><a>{label}</a></div>
        );
    }

    render() {
        const {
            onFocus,
            onBlur,
            labelText,
            modelDefinition,
            models,
            referenceType,
            referenceProperty,
            isInteger,
            translateOptions,
            isRequired,
            options,
            model,
            limit,
            fullWidth,
            translateLabel,
            ...other
        } = this.props;

        return this.state.options.length > limit
            ? (
                <div style={{ width: fullWidth ? '100%' : 'inherit', position: 'relative' }}>
                    <Dialog
                        title={labelText}
                        open={this.state.dialogOpen}
                        onRequestClose={this.closeDialog}
                        autoScrollBodyContent
                        autoDetectWindowHeight
                        actions={[
                            <FlatButton onClick={this.closeDialog} label={this.getTranslation('cancel')} />
                        ]}
                    >
                        <TextField
                            floatingLabelText='Filter list'
                            onChange={(e, value) => { this.setState({ filterText: value }); }}
                            style={{ marginBottom: 16 }}
                        />
                        {!this.props.isRequired && this.renderDialogOption(null, this.getTranslation('no_value'))}
                        {this.state.options
                            .filter(o => !this.state.filterText || this.state.filterText
                                .trim().toLocaleLowerCase().split(' ').every(
                                    f => o.text.toLocaleLowerCase().includes(f.toLocaleLowerCase())
                                )
                            )
                            .map(o => this.renderDialogOption(o.value, o.text))
                        }
                    </Dialog>
                    <TextField
                        {...other}
                        fullWidth={fullWidth}
                        value={this.getOptionText(this.state.value)}
                        onClick={this.openDialog}
                        onChange={this.openDialog}
                        floatingLabelText={labelText}
                        inputStyle={{ cursor: 'pointer' }}
                    />
                    <div
                        style={{ position: 'absolute', top: 38, right: 4, color: 'rgba(0,0,0,0.25)' }}
                        className='material-icons'
                    >open_in_new</div>
                </div>
            ) : (
                <SelectField
                    value={this.state.value}
                    fullWidth={fullWidth}
                    {...other}
                    onChange={this._onChange}
                    floatingLabelText={labelText}
                >
                    {this.renderOptions()}
                </SelectField>
            );
    }

    renderOptions() {
        const options = this.state.options
            .map((option, index) => (
                <MenuItem
                    primaryText={option.text}
                    key={index}
                    value={option.value}
                    label={option.text}
                />
            ));

        if (!this.props.isRequired) {
            // When the value is not required we add an item that sets the value to null
            // For this value we pass an empty label to not show the label no_value
            // when this option is selected.
            options.unshift([
                <MenuItem
                    primaryText={this.getTranslation('no_value')}
                    key="no_value"
                    value={null}
                    label=" "
                />
            ]);
        }

        return options;
    }
}

Dropdown.propTypes = {
    defaultValue: React.PropTypes.oneOfType([
        React.PropTypes.string,
        React.PropTypes.number,
        React.PropTypes.bool,
    ]),
    onFocus: React.PropTypes.func,
    onBlur: React.PropTypes.func,
    options: React.PropTypes.array.isRequired,
    isRequired: React.PropTypes.bool,
    labelText: React.PropTypes.string.isRequired,
    translateOptions: React.PropTypes.bool,
    limit: React.PropTypes.number,
};

Dropdown.defaultProps = {
    limit: 50,
};

Dropdown.contextTypes = {
    d2: React.PropTypes.any,
};

export default Dropdown;