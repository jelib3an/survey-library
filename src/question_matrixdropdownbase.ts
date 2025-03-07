import {
  JsonObject,
  CustomPropertiesCollection,
  JsonObjectProperty,
  Serializer,
} from "./jsonobject";
import { QuestionMatrixBaseModel } from "./martixBase";
import { Question } from "./question";
import { HashTable, Helpers } from "./helpers";
import {
  Base,
  IElement,
  IQuestion,
  ISurveyData,
  ISurvey,
  ISurveyImpl,
  ITextProcessor,
  SurveyError,
  IProgressInfo,
  SurveyElement,
  IPanel,
  IWrapperObject,
} from "./base";
import {
  TextPreProcessorValue,
  QuestionTextProcessor,
} from "./textPreProcessor";
import { ItemValue } from "./itemvalue";
import { surveyLocalization } from "./surveyStrings";
import { QuestionSelectBase } from "./question_baseselect";
import { QuestionFactory } from "./questionfactory";
import { ILocalizableOwner, LocalizableString } from "./localizablestring";
import { SurveyValidator } from "./validator";
import { getCurrecyCodes } from "./question_expression";
import { FunctionFactory } from "./functionsfactory";
import { PanelModel } from "./panel";
import { settings } from "./settings";
import { KeyDuplicationError } from "./error";
import { ActionBarItem, IActionBarItem } from "./action-bar";
import { SurveyModel } from "./survey";

export interface IMatrixDropdownData {
  value: any;
  onRowChanged(
    row: MatrixDropdownRowModelBase,
    columnName: string,
    newRowValue: any,
    isDeletingValue: boolean
  ): void;
  onRowChanging(
    row: MatrixDropdownRowModelBase,
    columnName: string,
    rowValue: any
  ): any;
  isValidateOnValueChanging: boolean;
  getRowIndex(row: MatrixDropdownRowModelBase): number;
  getRowValue(rowIndex: number): any;
  checkIfValueInRowDuplicated(
    checkedRow: MatrixDropdownRowModelBase,
    cellQuestion: Question
  ): boolean;
  hasDetailPanel(row: MatrixDropdownRowModelBase): boolean;
  getIsDetailPanelShowing(row: MatrixDropdownRowModelBase): boolean;
  setIsDetailPanelShowing(row: MatrixDropdownRowModelBase, val: boolean): void;
  createRowDetailPanel(row: MatrixDropdownRowModelBase): PanelModel;
  validateCell(
    row: MatrixDropdownRowModelBase,
    columnName: string,
    rowValue: any
  ): SurveyError;
  columns: Array<MatrixDropdownColumn>;
  createQuestion(
    row: MatrixDropdownRowModelBase,
    column: MatrixDropdownColumn
  ): Question;
  getLocale(): string;
  getMarkdownHtml(text: string, name: string): string;
  getRenderer(name: string): string;
  getProcessedText(text: string): string;
  getSharedQuestionByName(
    columnName: string,
    row: MatrixDropdownRowModelBase
  ): Question;
  onTotalValueChanged(): any;
  getSurvey(): ISurvey;
}

export interface IMatrixColumnOwner extends ILocalizableOwner {
  getRequiredText(): string;
  onColumnPropertyChanged(
    column: MatrixDropdownColumn,
    name: string,
    newValue: any
  ): void;
  onShowInMultipleColumnsChanged(column: MatrixDropdownColumn): void;
  getCellType(): string;
  onColumnCellTypeChanged(column: MatrixDropdownColumn): void;
}

function onUpdateSelectBaseCellQuestion(
  cellQuestion: QuestionSelectBase,
  column: MatrixDropdownColumn,
  question: QuestionMatrixDropdownModelBase,
  data: any
) {
  cellQuestion.storeOthersAsComment = !!question
    ? question.storeOthersAsComment
    : false;
  if (
    (!cellQuestion.choices || cellQuestion.choices.length == 0) &&
    cellQuestion.choicesByUrl.isEmpty
  ) {
    cellQuestion.choices = question.choices;
  }
  if (!cellQuestion.choicesByUrl.isEmpty) {
    cellQuestion.choicesByUrl.run(data.getTextProcessor());
  }
}
export var matrixDropdownColumnTypes = {
  dropdown: {
    properties: [
      "choices",
      "choicesOrder",
      "choicesByUrl",
      "optionsCaption",
      "otherText",
      "choicesVisibleIf",
    ],
    onCellQuestionUpdate: (
      cellQuestion: any,
      column: any,
      question: any,
      data: any
    ) => {
      onUpdateSelectBaseCellQuestion(cellQuestion, column, question, data);
      if (
        !!cellQuestion.locOptionsCaption &&
        cellQuestion.locOptionsCaption.isEmpty &&
        !question.locOptionsCaption.isEmpty
      ) {
        cellQuestion.optionsCaption = question.optionsCaption;
      }
    },
  },
  checkbox: {
    properties: [
      "choices",
      "choicesOrder",
      "choicesByUrl",
      "otherText",
      "choicesVisibleIf",
      "hasSelectAll",
      "hasNone",
    ],
    onCellQuestionUpdate: (
      cellQuestion: any,
      column: any,
      question: any,
      data: any
    ) => {
      onUpdateSelectBaseCellQuestion(cellQuestion, column, question, data);
      cellQuestion.colCount =
        column.colCount > -1 ? column.colCount : question.columnColCount;
    },
  },
  radiogroup: {
    properties: [
      "choices",
      "choicesOrder",
      "choicesByUrl",
      "otherText",
      "choicesVisibleIf",
    ],
    onCellQuestionUpdate: (
      cellQuestion: any,
      column: any,
      question: any,
      data: any
    ) => {
      onUpdateSelectBaseCellQuestion(cellQuestion, column, question, data);
      cellQuestion.colCount =
        column.colCount > -1 ? column.colCount : question.columnColCount;
    },
  },
  text: {
    properties: ["placeHolder", "inputType", "maxLength", "min", "max", "step"],
    onCellQuestionUpdate: (
      cellQuestion: any,
      column: any,
      question: any,
      data: any
    ) => {},
  },
  comment: {
    properties: ["placeHolder", "rows", "maxLength"],
    onCellQuestionUpdate: (
      cellQuestion: any,
      column: any,
      question: any,
      data: any
    ) => {},
  },
  boolean: {
    properties: ["renderAs", "defaultValue"],
    onCellQuestionUpdate: (
      cellQuestion: any,
      column: any,
      question: any,
      data: any
    ) => {
      cellQuestion.showTitle = true;
      cellQuestion.renderAs = column.renderAs;
    },
  },
  expression: {
    properties: ["expression", "displayStyle", "currency"],
    onCellQuestionUpdate: (
      cellQuestion: any,
      column: any,
      question: any,
      data: any
    ) => {},
  },
  rating: {
    properties: ["rateValues"],
  },
};

export class MatrixDropdownColumn extends Base
  implements ILocalizableOwner, IWrapperObject {
  public static getColumnTypes(): Array<string> {
    var res = [];
    for (var key in matrixDropdownColumnTypes) {
      res.push(key);
    }
    return res;
  }
  private templateQuestionValue: Question;
  private colOwnerValue: IMatrixColumnOwner = null;
  private indexValue = -1;
  private _isVisible = true;
  private _hasVisibleCell = true;

  constructor(name: string, title: string = null) {
    super();
    var self = this;
    this.createLocalizableString("totalFormat", this);
    this.registerFunctionOnPropertyValueChanged(
      "showInMultipleColumns",
      function() {
        self.doShowInMultipleColumnsChanged();
      }
    );
    this.updateTemplateQuestion();
    this.name = name;
    if (title) {
      this.title = title;
    } else {
      this.templateQuestion.locTitle.strChanged();
    }
  }
  public getOriginalObj(): Base {
    return this.templateQuestion;
  }
  getClassNameProperty(): string {
    return "cellType";
  }
  public getSurvey(live: boolean = false): ISurvey {
    return !!this.colOwner ? (<any>this.colOwner).survey : null;
  }
  endLoadingFromJson() {
    super.endLoadingFromJson();
    this.templateQuestion.endLoadingFromJson();
    this.templateQuestion.onGetSurvey = () => {
      return this.getSurvey();
    };
  }
  getDynamicPropertyName(): string {
    return "cellType";
  }
  getDynamicType(): string {
    return this.calcCellQuestionType();
  }
  public get colOwner(): IMatrixColumnOwner {
    return this.colOwnerValue;
  }
  public set colOwner(value: IMatrixColumnOwner) {
    this.colOwnerValue = value;
    if (!!value) {
      this.updateTemplateQuestion();
    }
  }
  public locStrsChanged() {
    super.locStrsChanged();
    this.locTitle.strChanged();
  }
  public addUsedLocales(locales: Array<string>) {
    super.addUsedLocales(locales);
    this.templateQuestion.addUsedLocales(locales);
  }
  public get index() {
    return this.indexValue;
  }
  public setIndex(val: number) {
    this.indexValue = val;
  }
  public getType() {
    return "matrixdropdowncolumn";
  }
  public get cellType(): string {
    return this.getPropertyValue("cellType");
  }
  public set cellType(val: string) {
    val = val.toLocaleLowerCase();
    this.setPropertyValue("cellType", val);
    this.updateTemplateQuestion();
    if (!!this.colOwner) {
      this.colOwner.onColumnCellTypeChanged(this);
    }
  }
  public get templateQuestion() {
    return this.templateQuestionValue;
  }
  public get value() {
    return this.templateQuestion.name;
  }
  public get isVisible() {
    return this._isVisible;
  }
  public setIsVisible(newVal: boolean) {
    this._isVisible = newVal;
  }
  public get hasVisibleCell() {
    return this._hasVisibleCell;
  }
  public set hasVisibleCell(newVal: boolean) {
    this._hasVisibleCell = newVal;
  }
  public get name() {
    return this.templateQuestion.name;
  }
  public set name(val: string) {
    this.templateQuestion.name = val;
  }
  public get title(): string {
    return this.templateQuestion.title;
  }
  public set title(val: string) {
    this.templateQuestion.title = val;
  }
  public get locTitle() {
    return this.templateQuestion.locTitle;
  }
  public get fullTitle(): string {
    return this.locTitle.textOrHtml;
  }
  public get isRequired(): boolean {
    return this.templateQuestion.isRequired;
  }
  public set isRequired(val: boolean) {
    this.templateQuestion.isRequired = val;
  }
  public get requiredText(): string {
    return this.templateQuestion.requiredText;
  }
  public get requiredErrorText(): string {
    return this.templateQuestion.requiredErrorText;
  }
  public set requiredErrorText(val: string) {
    this.templateQuestion.requiredErrorText = val;
  }
  get locRequiredErrorText(): LocalizableString {
    return this.templateQuestion.locRequiredErrorText;
  }
  public get readOnly(): boolean {
    return this.templateQuestion.readOnly;
  }
  public set readOnly(val: boolean) {
    this.templateQuestion.readOnly = val;
  }
  public get hasOther(): boolean {
    return this.templateQuestion.hasOther;
  }
  public set hasOther(val: boolean) {
    this.templateQuestion.hasOther = val;
  }
  public get visibleIf(): string {
    return this.templateQuestion.visibleIf;
  }
  public set visibleIf(val: string) {
    this.templateQuestion.visibleIf = val;
  }
  public get enableIf(): string {
    return this.templateQuestion.enableIf;
  }
  public set enableIf(val: string) {
    this.templateQuestion.enableIf = val;
  }
  public get requiredIf(): string {
    return this.templateQuestion.requiredIf;
  }
  public set requiredIf(val: string) {
    this.templateQuestion.requiredIf = val;
  }
  public get isUnique(): boolean {
    return this.getPropertyValue("isUnique");
  }
  public set isUnique(val: boolean) {
    this.setPropertyValue("isUnique", val);
  }
  public get showInMultipleColumns(): boolean {
    return this.getPropertyValue("showInMultipleColumns", false);
  }
  public set showInMultipleColumns(val: boolean) {
    this.setPropertyValue("showInMultipleColumns", val);
  }
  public get isSupportMultipleColumns(): boolean {
    return ["checkbox", "radiogroup"].indexOf(this.cellType) > -1;
  }
  public get isShowInMultipleColumns(): boolean {
    return this.showInMultipleColumns && this.isSupportMultipleColumns;
  }
  public get validators(): Array<SurveyValidator> {
    return this.templateQuestion.validators;
  }
  public set validators(val: Array<SurveyValidator>) {
    this.templateQuestion.validators = val;
  }
  public get totalType(): string {
    return this.getPropertyValue("totalType", "none");
  }
  public set totalType(val: string) {
    this.setPropertyValue("totalType", val);
  }
  public get totalExpression(): string {
    return this.getPropertyValue("totalExpression");
  }
  public set totalExpression(val: string) {
    this.setPropertyValue("totalExpression", val);
  }
  public get hasTotal(): boolean {
    return this.totalType != "none" || !!this.totalExpression;
  }
  public get totalFormat(): string {
    return this.getLocalizableStringText("totalFormat", "");
  }
  public set totalFormat(val: string) {
    this.setLocalizableStringText("totalFormat", val);
  }
  get locTotalFormat(): LocalizableString {
    return this.getLocalizableString("totalFormat");
  }
  public get renderAs(): string {
    return this.getPropertyValue("renderAs");
  }
  public set renderAs(val: string) {
    this.setPropertyValue("renderAs", val);
  }
  public get totalMaximumFractionDigits(): number {
    return this.getPropertyValue("totalMaximumFractionDigits", -1);
  }
  public set totalMaximumFractionDigits(val: number) {
    if (val < -1 || val > 20) return;
    this.setPropertyValue("totalMaximumFractionDigits", val);
  }
  public get totalMinimumFractionDigits(): number {
    return this.getPropertyValue("totalMinimumFractionDigits", -1);
  }
  public set totalMinimumFractionDigits(val: number) {
    if (val < -1 || val > 20) return;
    this.setPropertyValue("totalMinimumFractionDigits", val);
  }
  public get totalDisplayStyle(): string {
    return this.getPropertyValue("totalDisplayStyle");
  }
  public set totalDisplayStyle(val: string) {
    this.setPropertyValue("totalDisplayStyle", val);
  }
  public get totalCurrency(): string {
    return this.getPropertyValue("totalCurrency");
  }
  public set totalCurrency(val: string) {
    if (getCurrecyCodes().indexOf(val) < 0) return;
    this.setPropertyValue("totalCurrency", val);
  }
  public get minWidth(): string {
    return this.getPropertyValue("minWidth", "");
  }
  public set minWidth(val: string) {
    this.setPropertyValue("minWidth", val);
  }
  public get width(): string {
    return this.getPropertyValue("width", "");
  }
  public set width(val: string) {
    this.setPropertyValue("width", val);
  }
  public get colCount(): number {
    return this.getPropertyValue("colCount", -1);
  }
  public set colCount(val: number) {
    if (val < -1 || val > 4) return;
    this.setPropertyValue("colCount", val);
  }
  public getLocale(): string {
    return this.colOwner ? this.colOwner.getLocale() : "";
  }
  public getMarkdownHtml(text: string, name: string): string {
    return this.colOwner ? this.colOwner.getMarkdownHtml(text, name) : null;
  }
  public getRenderer(name: string): string {
    return !!this.colOwner ? this.colOwner.getRenderer(name) : null;
  }
  public getProcessedText(text: string): string {
    return this.colOwner ? this.colOwner.getProcessedText(text) : text;
  }
  public createCellQuestion(data: any): Question {
    var qType = this.calcCellQuestionType();
    var cellQuestion = <Question>this.createNewQuestion(qType);
    this.callOnCellQuestionUpdate(cellQuestion, data);
    return cellQuestion;
  }
  public updateCellQuestion(
    cellQuestion: Question,
    data: any,
    onUpdateJson: (json: any) => any = null
  ) {
    this.setQuestionProperties(cellQuestion, onUpdateJson);
    this.callOnCellQuestionUpdate(cellQuestion, data);
  }
  private callOnCellQuestionUpdate(cellQuestion: Question, data: any) {
    var qType = cellQuestion.getType();
    var qDefinition = (<any>matrixDropdownColumnTypes)[qType];
    if (qDefinition && qDefinition["onCellQuestionUpdate"]) {
      qDefinition["onCellQuestionUpdate"](
        cellQuestion,
        this,
        this.colOwner,
        data
      );
    }
  }
  defaultCellTypeChanged() {
    this.updateTemplateQuestion();
  }
  protected calcCellQuestionType(): string {
    if (this.cellType !== "default") return this.cellType;
    if (this.colOwner) return this.colOwner.getCellType();
    return settings.matrixDefaultCellType;
  }
  protected updateTemplateQuestion() {
    var prevCellType = this.templateQuestion
      ? this.templateQuestion.getType()
      : "";
    var curCellType = this.calcCellQuestionType();
    if (curCellType === prevCellType) return;
    if (this.templateQuestion) {
      this.removeProperties(prevCellType);
    }
    this.templateQuestionValue = this.createNewQuestion(curCellType);
    this.templateQuestion.locOwner = this;
    this.addProperties(curCellType);
    var self = this;
    this.templateQuestion.onPropertyChanged.add(function(sender, options) {
      self.propertyValueChanged(
        options.name,
        options.oldValue,
        options.newValue
      );
    });
    this.templateQuestion.isContentElement = true;
    if (!this.isLoadingFromJson) {
      this.templateQuestion.onGetSurvey = () => {
        return this.getSurvey();
      };
    }
  }
  protected createNewQuestion(cellType: string): Question {
    var question = <Question>Serializer.createClass(cellType);
    if (!question) {
      question = <Question>Serializer.createClass("text");
    }
    question.loadingOwner = this;
    question.isEditableTemplateElement = true;
    this.setQuestionProperties(question);
    return question;
  }
  protected setQuestionProperties(
    question: Question,
    onUpdateJson: (json: any) => any = null
  ) {
    if (this.templateQuestion) {
      var json = new JsonObject().toJsonObject(this.templateQuestion, true);
      if (onUpdateJson) {
        onUpdateJson(json);
      }
      json.type = question.getType();
      new JsonObject().toObject(json, question);
    }
  }
  protected propertyValueChanged(name: string, oldValue: any, newValue: any) {
    super.propertyValueChanged(name, oldValue, newValue);
    if (!Serializer.hasOriginalProperty(this, name)) return;
    if (this.colOwner != null && !this.isLoadingFromJson) {
      this.colOwner.onColumnPropertyChanged(this, name, newValue);
    }
  }
  private doShowInMultipleColumnsChanged() {
    if (this.colOwner != null && !this.isLoadingFromJson) {
      this.colOwner.onShowInMultipleColumnsChanged(this);
    }
  }
  private getProperties(curCellType: string): Array<JsonObjectProperty> {
    return Serializer.getDynamicPropertiesByObj(this, curCellType);
  }
  private removeProperties(curCellType: string) {
    var properties = this.getProperties(curCellType);
    for (var i = 0; i < properties.length; i++) {
      var prop = properties[i];
      delete (<any>this)[prop.name];
      if (prop.serializationProperty) {
        delete (<any>this)[prop.serializationProperty];
      }
    }
  }
  private addProperties(curCellType: string) {
    var question = this.templateQuestion;
    var properties = this.getProperties(curCellType);
    for (var i = 0; i < properties.length; i++) {
      var prop = properties[i];
      this.addProperty(question, prop.name, false);
      if (prop.serializationProperty) {
        this.addProperty(question, prop.serializationProperty, true);
      }
    }
  }
  private addProperty(
    question: Question,
    propName: string,
    isReadOnly: boolean
  ) {
    var desc = {
      configurable: true,
      get: function() {
        return (<any>question)[propName];
      },
    };
    if (!isReadOnly) {
      (<any>desc)["set"] = function(v: any) {
        (<any>question)[propName] = v;
      };
    }
    Object.defineProperty(this, propName, desc);
  }
}

export class MatrixDropdownCell {
  private questionValue: Question;
  constructor(
    public column: MatrixDropdownColumn,
    public row: MatrixDropdownRowModelBase,
    public data: IMatrixDropdownData
  ) {
    this.questionValue = this.createQuestion(column, row, data);
    this.questionValue.updateCustomWidget();
  }
  public locStrsChanged() {
    this.question.locStrsChanged();
  }
  protected createQuestion(
    column: MatrixDropdownColumn,
    row: MatrixDropdownRowModelBase,
    data: IMatrixDropdownData
  ): Question {
    var res = data.createQuestion(this.row, this.column);
    res.validateValueCallback = function() {
      return data.validateCell(row, column.name, row.value);
    };
    CustomPropertiesCollection.getProperties(column.getType()).forEach(
      (property) => {
        let propertyName = property.name;
        if ((<any>column)[propertyName] !== undefined) {
          res[propertyName] = (<any>column)[propertyName];
        }
      }
    );
    return res;
  }
  public get question(): Question {
    return this.questionValue;
  }
  public get value(): any {
    return this.question.value;
  }
  public set value(value: any) {
    this.question.value = value;
  }
  public runCondition(values: HashTable<any>, properties: HashTable<any>) {
    this.question.runCondition(values, properties);
  }
}

export class MatrixDropdownTotalCell extends MatrixDropdownCell {
  constructor(
    public column: MatrixDropdownColumn,
    public row: MatrixDropdownRowModelBase,
    public data: IMatrixDropdownData
  ) {
    super(column, row, data);
    this.updateCellQuestion();
  }
  protected createQuestion(
    column: MatrixDropdownColumn,
    row: MatrixDropdownRowModelBase,
    data: IMatrixDropdownData
  ): Question {
    var res = <Question>Serializer.createClass("expression");
    res.setSurveyImpl(row);
    return res;
  }
  public locStrsChanged() {
    this.updateCellQuestion();
    super.locStrsChanged();
  }
  public updateCellQuestion() {
    this.question.locCalculation();
    this.column.updateCellQuestion(this.question, null, function(json) {
      delete json["defaultValue"];
    });
    this.question.expression = this.getTotalExpression();
    this.question.format = this.column.totalFormat;
    this.question.currency = this.column.totalCurrency;
    this.question.displayStyle = this.column.totalDisplayStyle;
    this.question.maximumFractionDigits = this.column.totalMaximumFractionDigits;
    this.question.minimumFractionDigits = this.column.totalMinimumFractionDigits;
    this.question.unlocCalculation();
    this.question.runIfReadOnly = true;
  }
  public getTotalExpression(): string {
    if (!!this.column.totalExpression) return this.column.totalExpression;
    if (this.column.totalType == "none") return "";
    var funName = this.column.totalType + "InArray";
    if (!FunctionFactory.Instance.hasFunction(funName)) return "";
    return funName + "({self}, '" + this.column.name + "')";
  }
}

class MatrixDropdownRowTextProcessor extends QuestionTextProcessor {
  constructor(
    protected row: MatrixDropdownRowModelBase,
    protected variableName: string
  ) {
    super(variableName);
  }
  protected get survey(): ISurvey {
    return this.row.getSurvey();
  }
  protected getValues(): any {
    return this.row.value;
  }
  protected getQuestionByName(name: string): Question {
    return this.row.getQuestionByName(name);
  }
  protected onCustomProcessText(textValue: TextPreProcessorValue): boolean {
    if (textValue.name == MatrixDropdownRowModelBase.IndexVariableName) {
      textValue.isExists = true;
      textValue.value = this.row.rowIndex;
      return true;
    }
    if (textValue.name == MatrixDropdownRowModelBase.RowValueVariableName) {
      textValue.isExists = true;
      textValue.value = this.row.rowName;
      return true;
    }
    return false;
  }
}

export class MatrixDropdownRowModelBase
  implements ISurveyData, ISurveyImpl, ILocalizableOwner {
  public static RowVariableName = "row";
  public static OwnerVariableName = "self";
  public static IndexVariableName = "rowIndex";
  public static RowValueVariableName = "rowValue";

  private static idCounter: number = 1;
  private static getId(): string {
    return "srow_" + MatrixDropdownRowModelBase.idCounter++;
  }
  protected data: IMatrixDropdownData;
  protected isSettingValue: boolean = false;
  private idValue: string;
  private textPreProcessor: MatrixDropdownRowTextProcessor;
  private detailPanelValue: PanelModel = null;

  public cells: Array<MatrixDropdownCell> = [];
  public showHideDetailPanelClick: any;

  constructor(data: IMatrixDropdownData, value: any) {
    this.data = data;
    this.subscribeToChanges(value);
    this.textPreProcessor = new MatrixDropdownRowTextProcessor(
      this,
      MatrixDropdownRowModelBase.RowVariableName
    );
    this.showHideDetailPanelClick = () => {
      this.showHideDetailPanel();
    };
    this.idValue = MatrixDropdownRowModelBase.getId();
  }
  public get id(): string {
    return this.idValue;
  }
  public get rowName(): any {
    return null;
  }
  public get value(): any {
    var result: any = {};
    var questions = this.questions;
    for (var i = 0; i < questions.length; i++) {
      var question = questions[i];
      if (!question.isEmpty()) {
        result[question.getValueName()] = question.value;
      }
      if (
        !!question.comment &&
        !!this.getSurvey() &&
        this.getSurvey().storeOthersAsComment
      ) {
        result[question.getValueName() + settings.commentPrefix] =
          question.comment;
      }
    }
    return result;
  }
  public get locText(): LocalizableString {
    return null;
  }
  public get hasPanel(): boolean {
    if (!this.data) return false;
    return this.data.hasDetailPanel(this);
  }
  public get detailPanel(): PanelModel {
    return this.detailPanelValue;
  }
  public get detailPanelId(): string {
    return !!this.detailPanel ? this.detailPanel.id : "";
  }
  public get isDetailPanelShowing(): boolean {
    return !!this.data ? this.data.getIsDetailPanelShowing(this) : false;
  }
  private setIsDetailPanelShowing(val: boolean) {
    if (!!this.data) {
      this.data.setIsDetailPanelShowing(this, val);
    }
  }
  private showHideDetailPanel() {
    if (this.isDetailPanelShowing) {
      this.hideDetailPanel();
    } else {
      this.showDetailPanel();
    }
  }
  private isCreatingDetailPanel = false;
  public showDetailPanel() {
    this.ensureDetailPanel();
    if (!this.detailPanelValue) return;
    this.setIsDetailPanelShowing(true);
  }
  public hideDetailPanel(destroyPanel: boolean = false) {
    this.setIsDetailPanelShowing(false);
    if (destroyPanel) {
      this.detailPanelValue = null;
    }
  }
  private ensureDetailPanel() {
    if (this.isCreatingDetailPanel) return;
    if (!!this.detailPanelValue || !this.hasPanel || !this.data) return;
    this.isCreatingDetailPanel = true;
    this.detailPanelValue = this.data.createRowDetailPanel(this);
    var questions = this.detailPanelValue.questions;
    var value = this.data.getRowValue(this.data.getRowIndex(this));
    if (!Helpers.isValueEmpty(value)) {
      for (var i = 0; i < questions.length; i++) {
        var key = questions[i].getValueName();
        if (!Helpers.isValueEmpty(value[key])) {
          questions[i].value = value[key];
        }
      }
    }
    this.detailPanelValue.setSurveyImpl(this);
    this.isCreatingDetailPanel = false;
  }
  getAllValues(): any {
    return this.value;
  }
  getFilteredValues(): any {
    var allValues = this.getAllValues();
    var values: { [key: string]: any } = { row: allValues };
    for (var key in allValues) {
      values[key] = allValues[key];
    }
    return values;
  }
  getFilteredProperties(): any {
    return { survey: this.getSurvey(), row: this };
  }
  public runCondition(values: HashTable<any>, properties: HashTable<any>) {
    if (!!this.data) {
      values[MatrixDropdownRowModelBase.OwnerVariableName] = this.data.value;
    }
    values[MatrixDropdownRowModelBase.IndexVariableName] = this.rowIndex;
    values[MatrixDropdownRowModelBase.RowValueVariableName] = this.rowName;
    if (!properties) properties = {};
    properties[MatrixDropdownRowModelBase.RowVariableName] = this;
    for (var i = 0; i < this.cells.length; i++) {
      values[MatrixDropdownRowModelBase.RowVariableName] = this.value;
      this.cells[i].runCondition(values, properties);
    }
    if (!!this.detailPanel) {
      this.detailPanel.runCondition(values, properties);
    }
  }
  public clearValue() {
    var questions = this.questions;
    for (var i = 0; i < questions.length; i++) {
      questions[i].clearValue();
    }
  }
  public set value(value: any) {
    this.isSettingValue = true;
    this.subscribeToChanges(value);
    var questions = this.questions;
    for (var i = 0; i < questions.length; i++) {
      var question = questions[i];
      var val = this.getCellValue(value, question.getValueName());
      var oldComment = question.comment;
      var comment = !!value
        ? value[question.getValueName() + settings.commentPrefix]
        : "";
      if (comment == undefined) comment = "";
      question.updateValueFromSurvey(val);
      if (!!comment || Helpers.isTwoValueEquals(oldComment, question.comment)) {
        question.updateCommentFromSurvey(comment);
      }
      question.onSurveyValueChanged(val);
    }
    this.isSettingValue = false;
  }
  public onAnyValueChanged(name: string) {
    var questions = this.questions;
    for (var i = 0; i < questions.length; i++) {
      questions[i].onAnyValueChanged(name);
    }
  }
  public getDataValueCore(valuesHash: any, key: string) {
    var survey = this.getSurvey();
    if (!!survey) {
      return (<any>survey).getDataValueCore(valuesHash, key);
    } else {
      return valuesHash[key];
    }
  }
  public getValue(name: string): any {
    var question = this.getQuestionByName(name);
    return !!question ? question.value : null;
  }
  public setValue(name: string, newColumnValue: any) {
    this.setValueCore(name, newColumnValue, false);
  }
  getVariable(name: string): any {
    return undefined;
  }
  setVariable(name: string, newValue: any) {}
  public getComment(name: string): string {
    var question = this.getQuestionByName(name);
    return !!question ? question.comment : "";
  }
  public setComment(name: string, newValue: string, locNotification: any) {
    this.setValueCore(name, newValue, true);
  }
  private setValueCore(name: string, newColumnValue: any, isComment: boolean) {
    if (this.isSettingValue) return;
    this.updateQuestionsValue(name, newColumnValue, isComment);
    var newValue = this.value;
    var changedName = isComment ? name + settings.commentPrefix : name;
    var changedValue = isComment ? this.getComment(name) : this.getValue(name);
    var changedQuestion = this.getQuestionByName(name);
    var changingValue = this.data.onRowChanging(this, changedName, newValue);
    if (
      !!changedQuestion &&
      !Helpers.isTwoValueEquals(changingValue, changedValue)
    ) {
      if (isComment) {
        changedQuestion.comment = changingValue;
      } else {
        changedQuestion.value = changingValue;
      }
    } else {
      if (
        this.data.isValidateOnValueChanging &&
        this.hasQuestonError(changedQuestion)
      )
        return;
      this.data.onRowChanged(
        this,
        changedName,
        newValue,
        newColumnValue == null && !changedQuestion
      );
      this.onAnyValueChanged(MatrixDropdownRowModelBase.RowVariableName);
    }
  }

  private updateQuestionsValue(
    name: string,
    newColumnValue: any,
    isComment: boolean
  ) {
    if (!this.detailPanel) return;
    var colQuestion = this.getQuestionByColumnName(name);
    var detailQuestion = this.detailPanel.getQuestionByName(name);
    if (!colQuestion || !detailQuestion) return;
    var isColQuestion = Helpers.isTwoValueEquals(
      newColumnValue,
      isComment ? colQuestion.comment : colQuestion.value
    );
    var question = isColQuestion ? detailQuestion : colQuestion;
    this.isSettingValue = true;
    if (!isComment) {
      question.value = newColumnValue;
    } else {
      question.comment = newColumnValue;
    }
    this.isSettingValue = false;
  }

  private hasQuestonError(question: Question): boolean {
    if (!question) return false;
    if (
      question.hasErrors(true, {
        isOnValueChanged: !this.data.isValidateOnValueChanging,
      })
    )
      return true;
    if (question.isEmpty()) return false;
    var cell = this.getCellByColumnName(question.name);
    if (!cell || !cell.column || !cell.column.isUnique) return false;
    return this.data.checkIfValueInRowDuplicated(this, question);
  }
  public get isEmpty() {
    var val = this.value;
    if (Helpers.isValueEmpty(val)) return true;
    for (var key in val) {
      if (val[key] !== undefined && val[key] !== null) return false;
    }
    return true;
  }
  public getQuestionByColumn(column: MatrixDropdownColumn): Question {
    for (var i = 0; i < this.cells.length; i++) {
      if (this.cells[i].column == column) return this.cells[i].question;
    }
    return null;
  }
  private getCellByColumnName(columnName: string): MatrixDropdownCell {
    for (var i = 0; i < this.cells.length; i++) {
      if (this.cells[i].column.name == columnName) return this.cells[i];
    }
    return null;
  }
  public getQuestionByColumnName(columnName: string): Question {
    var cell = this.getCellByColumnName(columnName);
    return !!cell ? cell.question : null;
  }
  public get questions(): Array<Question> {
    var res: Array<Question> = [];
    for (var i = 0; i < this.cells.length; i++) {
      res.push(this.cells[i].question);
    }
    var detailQuestions = !!this.detailPanel ? this.detailPanel.questions : [];
    for (var i = 0; i < detailQuestions.length; i++) {
      res.push(detailQuestions[i]);
    }
    return res;
  }
  public getQuestionByName(name: string): Question {
    var res = this.getQuestionByColumnName(name);
    if (!!res) return res;
    return !!this.detailPanel ? this.detailPanel.getQuestionByName(name) : null;
  }
  public getQuestionsByName(name: string): Array<Question> {
    let res = [];
    let q = this.getQuestionByColumnName(name);
    if (!!q) res.push(q);
    if (!!this.detailPanel) {
      q = this.detailPanel.getQuestionByName(name);
      if (!!q) res.push(q);
    }
    return res;
  }
  protected getSharedQuestionByName(columnName: string): Question {
    return !!this.data
      ? this.data.getSharedQuestionByName(columnName, this)
      : null;
  }
  public clearIncorrectValues(val: any) {
    for (var key in val) {
      var question = this.getQuestionByName(key);
      if (question) {
        var qVal = question.value;
        question.clearIncorrectValues();
        if (!Helpers.isTwoValueEquals(qVal, question.value)) {
          this.setValue(key, question.value);
        }
      } else {
        if (
          !this.getSharedQuestionByName(key) &&
          key.indexOf(settings.matrixTotalValuePostFix) < 0
        ) {
          this.setValue(key, null);
        }
      }
    }
  }
  public getLocale(): string {
    return this.data ? this.data.getLocale() : "";
  }
  public getMarkdownHtml(text: string, name: string): string {
    return this.data ? this.data.getMarkdownHtml(text, name) : null;
  }
  public getRenderer(name: string): string {
    return this.data ? this.data.getRenderer(name) : null;
  }
  public getProcessedText(text: string): string {
    return this.data ? this.data.getProcessedText(text) : text;
  }
  public locStrsChanged() {
    for (var i = 0; i < this.cells.length; i++) {
      this.cells[i].locStrsChanged();
    }
    if (!!this.detailPanel) {
      this.detailPanel.locStrsChanged();
    }
  }
  public updateCellQuestionOnColumnChanged(
    column: MatrixDropdownColumn,
    name: string,
    newValue: any
  ) {
    for (var i = 0; i < this.cells.length; i++) {
      if (this.cells[i].column === column) {
        this.updateCellOnColumnChanged(this.cells[i], name, newValue);
        return;
      }
    }
  }
  public onQuestionReadOnlyChanged(parentIsReadOnly: boolean) {
    var questions = this.questions;
    for (var i = 0; i < questions.length; i++) {
      questions[i].readOnly = parentIsReadOnly;
    }
  }
  public hasErrors(
    fireCallback: boolean,
    rec: any,
    raiseOnCompletedAsyncValidators: () => void
  ): boolean {
    var res = false;
    var cells = this.cells;
    if (!cells) return res;
    for (var colIndex = 0; colIndex < cells.length; colIndex++) {
      if (!cells[colIndex]) continue;
      var question = cells[colIndex].question;
      if (!question || !question.visible) continue;
      question.onCompletedAsyncValidators = (hasErrors: boolean) => {
        raiseOnCompletedAsyncValidators();
      };
      if (!!rec && rec.isOnValueChanged === true && question.isEmpty())
        continue;
      res = question.hasErrors(fireCallback, rec) || res;
    }
    if (this.hasPanel) {
      this.ensureDetailPanel();
      var panelHasError = this.detailPanel.hasErrors(fireCallback, false, rec);
      if (!rec.hideErroredPanel && panelHasError && fireCallback) {
        if (rec.isSingleDetailPanel) {
          rec.hideErroredPanel = true;
        }
        this.showDetailPanel();
      }
      res = panelHasError || res;
    }
    return res;
  }

  protected updateCellOnColumnChanged(
    cell: MatrixDropdownCell,
    name: string,
    newValue: any
  ) {
    cell.question[name] = newValue;
  }
  protected buildCells(value: any) {
    this.isSettingValue = true;
    var columns = this.data.columns;
    for (var i = 0; i < columns.length; i++) {
      var column = columns[i];
      if (!column.isVisible) continue;
      var cell = this.createCell(column);
      this.cells.push(cell);
      var cellValue = this.getCellValue(value, column.name);
      if (!Helpers.isValueEmpty(cellValue)) {
        cell.question.value = cellValue;
        var commentKey = column.name + settings.commentPrefix;
        if (!!value && !Helpers.isValueEmpty(value[commentKey])) {
          cell.question.comment = value[commentKey];
        }
      }
    }
    this.isSettingValue = false;
  }
  private getCellValue(value: any, name: string): any {
    if (!!this.editingObj)
      return Serializer.getObjPropertyValue(this.editingObj, name);
    return !!value ? value[name] : undefined;
  }
  protected createCell(column: MatrixDropdownColumn): MatrixDropdownCell {
    return new MatrixDropdownCell(column, this, this.data);
  }
  getSurveyData(): ISurveyData {
    return this;
  }
  getSurvey(): ISurvey {
    return this.data ? this.data.getSurvey() : null;
  }
  getTextProcessor(): ITextProcessor {
    return this.textPreProcessor;
  }
  public get rowIndex(): number {
    return !!this.data ? this.data.getRowIndex(this) + 1 : -1;
  }
  public get editingObj(): Base {
    return this.editingObjValue;
  }
  private onEditingObjPropertyChanged: (sender: Base, options: any) => void;
  private editingObjValue: Base;
  public dispose() {
    if (!!this.editingObj) {
      this.editingObj.onPropertyChanged.remove(
        this.onEditingObjPropertyChanged
      );
      this.editingObjValue = null;
    }
  }
  private subscribeToChanges(value: any) {
    if (!value || !value.getType || !value.onPropertyChanged) return;
    if (value === this.editingObj) return;
    this.editingObjValue = <Base>value;
    this.onEditingObjPropertyChanged = (sender: Base, options: any) => {
      this.updateOnSetValue(options.name, options.newValue);
    };
    this.editingObj.onPropertyChanged.add(this.onEditingObjPropertyChanged);
  }
  private updateOnSetValue(name: string, newValue: any) {
    this.isSettingValue = true;
    let questions = this.getQuestionsByName(name);
    for (let i = 0; i < questions.length; i++) {
      questions[i].value = newValue;
    }
    this.isSettingValue = false;
  }
}
export class MatrixDropdownTotalRowModel extends MatrixDropdownRowModelBase {
  constructor(data: IMatrixDropdownData) {
    super(data, null);
    this.buildCells(null);
  }
  protected createCell(column: MatrixDropdownColumn): MatrixDropdownCell {
    return new MatrixDropdownTotalCell(column, this, this.data);
  }
  public setValue(name: string, newValue: any) {
    if (!!this.data && !this.isSettingValue) {
      this.data.onTotalValueChanged();
    }
  }
  public runCondition(values: HashTable<any>, properties: HashTable<any>) {
    var counter = 0;
    var prevValue;
    do {
      prevValue = Helpers.getUnbindValue(this.value);
      super.runCondition(values, properties);
      counter++;
    } while (!Helpers.isTwoValueEquals(prevValue, this.value) && counter < 3);
  }
  protected updateCellOnColumnChanged(
    cell: MatrixDropdownCell,
    name: string,
    newValue: any
  ) {
    (<MatrixDropdownTotalCell>cell).updateCellQuestion();
  }
}

export class QuestionMatrixDropdownRenderedCell {
  private static counter = 1;
  private idValue: number;
  private itemValue: ItemValue;
  public minWidth: string = "";
  public width: string = "";
  public locTitle: LocalizableString;
  public cell: MatrixDropdownCell;
  public column: MatrixDropdownColumn;
  public row: MatrixDropdownRowModelBase;
  public question: Question;
  public isRemoveRow: boolean;
  public choiceIndex: number;
  public matrix: QuestionMatrixDropdownModelBase;
  public requiredText: string;
  public isEmpty: boolean;
  public colSpans: number = 1;
  public panel: PanelModel;
  public isShowHideDetail: boolean;
  public isActionsCell: boolean = false;
  public className: string = "";
  public constructor() {
    this.idValue = QuestionMatrixDropdownRenderedCell.counter++;
  }
  public get hasQuestion(): boolean {
    return !!this.question;
  }
  public get hasTitle(): boolean {
    return !!this.locTitle;
  }
  public get hasPanel(): boolean {
    return !!this.panel;
  }
  public get id(): number {
    return this.idValue;
  }
  public get showErrorOnTop(): boolean {
    return this.showErrorOnCore("top");
  }
  public get showErrorOnBottom(): boolean {
    return this.showErrorOnCore("bottom");
  }
  private showErrorOnCore(location: string): boolean {
    return (
      this.getShowErrorLocation() == location &&
      (!this.isChoice || this.isFirstChoice)
    );
  }
  private getShowErrorLocation(): string {
    return this.hasQuestion ? this.question.survey.questionErrorLocation : "";
  }
  public get item(): ItemValue {
    return this.itemValue;
  }
  public set item(val: ItemValue) {
    this.itemValue = val;
    if (!!val) {
      val.hideCaption = true;
    }
  }
  public get isChoice(): boolean {
    return !!this.item;
  }
  public get choiceValue(): any {
    return this.isChoice ? this.item.value : null;
  }
  public get isCheckbox(): boolean {
    return this.isChoice && this.question.getType() == "checkbox";
  }
  public get isFirstChoice(): boolean {
    return this.choiceIndex === 0;
  }
  public get css(): string {
    return (
      this.className +
      (this.question.errors.length > 0 ? " " + this.question.cssError : "")
    );
  }
  public get headers(): string {
    if (
      this.cell &&
      this.cell.column &&
      this.cell.column.isShowInMultipleColumns
    ) {
      return this.item.locText.renderedHtml;
    }
    if (this.question && this.question.isVisible) {
      return this.question.locTitle.renderedHtml;
    }
    if (this.hasTitle) {
      return this.locTitle.renderedHtml || "";
    }
    return "";
  }

  public calculateFinalClassName(matrixCssClasses: any): string {
    const questionCss = this.cell.question.cssClasses;
    let className = "";
    if (!!questionCss) {
      className = "";
      if (!!questionCss.itemValue) {
        className += " " + questionCss.itemValue;
      }
      if (!!questionCss.asCell) {
        if (!!className) className += "";
        className += questionCss.asCell;
      }
    }
    if (!className && !!matrixCssClasses) {
      className = matrixCssClasses.cell;
    }
    className +=
      this.question.errors.length > 0 ? " " + questionCss.hasError : "";

    if (this.isChoice) {
      className += " " + matrixCssClasses.choiceCell;
    }
    //'text-align': $data.isChoice ? 'center': ''
    return className;
  }
}

export class QuestionMatrixDropdownRenderedRow {
  public isDetailRow: boolean = false;
  public row: MatrixDropdownRowModelBase;
  private static counter = 1;
  private idValue: number;
  public cells: Array<QuestionMatrixDropdownRenderedCell> = [];
  public className: string = "";
  public constructor() {
    this.idValue = QuestionMatrixDropdownRenderedRow.counter++;
  }
  public get id(): number {
    return this.idValue;
  }
}

export class QuestionMatrixDropdownRenderedTable extends Base {
  private headerRowValue: QuestionMatrixDropdownRenderedRow;
  private footerRowValue: QuestionMatrixDropdownRenderedRow;
  private hasRemoveRowsValue: boolean;
  private rowsActions: Array<Array<IActionBarItem>>;
  private cssClasses: any;
  public constructor(public matrix: QuestionMatrixDropdownModelBase) {
    super();
    this.createNewArray("rows");
    this.build();
  }
  public get showTable(): boolean {
    return this.getPropertyValue("showTable", true);
  }
  public get showHeader(): boolean {
    return this.getPropertyValue("showHeader");
  }
  public get showAddRowOnTop(): boolean {
    return this.getPropertyValue("showAddRowOnTop", false);
  }
  public get showAddRowOnBottom(): boolean {
    return this.getPropertyValue("showAddRowOnBottom", false);
  }
  public get showFooter(): boolean {
    return this.matrix.hasFooter && this.matrix.isColumnLayoutHorizontal;
  }
  public get hasFooter(): boolean {
    return !!this.footerRow;
  }
  public get hasRemoveRows(): boolean {
    return this.hasRemoveRowsValue;
  }
  public isRequireReset(): boolean {
    return (
      this.hasRemoveRows != this.matrix.canRemoveRows ||
      !this.matrix.isColumnLayoutHorizontal
    );
  }
  public get headerRow(): QuestionMatrixDropdownRenderedRow {
    return this.headerRowValue;
  }
  public get footerRow(): QuestionMatrixDropdownRenderedRow {
    return this.footerRowValue;
  }
  public get rows(): Array<QuestionMatrixDropdownRenderedRow> {
    return this.getPropertyValue("rows");
  }
  protected build() {
    this.hasRemoveRowsValue = this.matrix.canRemoveRows;
    //build rows now
    var rows = this.matrix.visibleRows;
    this.cssClasses = this.matrix.cssClasses;
    this.buildRowsActions();
    this.buildHeader();
    this.buildRows();
    this.buildFooter();
    this.updateShowTableAndAddRow();
  }
  public updateShowTableAndAddRow() {
    var showTable =
      this.rows.length > 0 ||
      this.matrix.isDesignMode ||
      !this.matrix.getShowColumnsIfEmpty();
    this.setPropertyValue("showTable", showTable);
    var showAddRow = this.matrix.canAddRow && showTable;
    var showAddRowOnTop = showAddRow;
    var showAddRowOnBottom = showAddRow;
    if (showAddRowOnTop) {
      if (this.matrix.getAddRowLocation() === "default") {
        showAddRowOnTop = this.matrix.columnLayout === "vertical";
      } else {
        showAddRowOnTop = this.matrix.getAddRowLocation() !== "bottom";
      }
    }
    if (showAddRowOnBottom && this.matrix.getAddRowLocation() !== "topBottom") {
      showAddRowOnBottom = !showAddRowOnTop;
    }
    this.setPropertyValue("showAddRowOnTop", showAddRowOnTop);
    this.setPropertyValue("showAddRowOnBottom", showAddRowOnBottom);
  }
  public onAddedRow() {
    if (this.getRenderedDataRowCount() >= this.matrix.visibleRows.length)
      return;
    var row = this.matrix.visibleRows[this.matrix.visibleRows.length - 1];
    this.rowsActions.push(this.buildRowActions(row));
    this.addHorizontalRow(
      this.rows,
      row,
      this.matrix.visibleRows.length == 1 && !this.matrix.showHeader
    );
    this.updateShowTableAndAddRow();
  }
  private getRenderedDataRowCount(): number {
    var res = 0;
    for (var i = 0; i < this.rows.length; i++) {
      if (!this.rows[i].isDetailRow) res++;
    }
    return res;
  }
  public onRemovedRow(row: MatrixDropdownRowModelBase) {
    var rowIndex = this.getRenderedRowIndex(row);
    if (rowIndex < 0) return;
    this.rowsActions.splice(rowIndex, 1);
    var removeCount = 1;
    if (
      rowIndex < this.rows.length - 1 &&
      this.rows[rowIndex + 1].isDetailRow
    ) {
      removeCount++;
    }
    this.rows.splice(rowIndex, removeCount);
    this.updateShowTableAndAddRow();
  }
  public onDetailPanelChangeVisibility(
    row: MatrixDropdownRowModelBase,
    isShowing: boolean
  ) {
    var rowIndex = this.getRenderedRowIndex(row);
    if (rowIndex < 0) return;
    var panelRowIndex =
      rowIndex < this.rows.length - 1 && this.rows[rowIndex + 1].isDetailRow
        ? rowIndex + 1
        : -1;
    if ((isShowing && panelRowIndex > -1) || (!isShowing && panelRowIndex < 0))
      return;
    if (isShowing) {
      var detailRow = this.createDetailPanelRow(row, this.rows[rowIndex]);
      this.rows.splice(rowIndex + 1, 0, detailRow);
    } else {
      this.rows.splice(panelRowIndex, 1);
    }
  }
  private getRenderedRowIndex(row: MatrixDropdownRowModelBase): number {
    for (var i = 0; i < this.rows.length; i++) {
      if (this.rows[i].row == row) return i;
    }
    return -1;
  }
  protected buildRowsActions() {
    this.rowsActions = [];
    var rows = this.matrix.visibleRows;
    for (var i = 0; i < rows.length; i++) {
      this.rowsActions.push(this.buildRowActions(rows[i]));
    }
  }
  protected buildHeader() {
    var colHeaders =
      this.matrix.isColumnLayoutHorizontal && this.matrix.showHeader;
    var isShown =
      colHeaders ||
      (this.matrix.hasRowText && !this.matrix.isColumnLayoutHorizontal);
    this.setPropertyValue("showHeader", isShown);
    if (!isShown) return;
    this.headerRowValue = new QuestionMatrixDropdownRenderedRow();
    if (this.hasActionCellInRows("start")) {
      this.headerRow.cells.push(this.createHeaderCell(null));
    }
    if (this.matrix.hasRowText && this.matrix.showHeader) {
      this.headerRow.cells.push(this.createHeaderCell(null));
    }
    if (this.matrix.isColumnLayoutHorizontal) {
      for (var i = 0; i < this.matrix.visibleColumns.length; i++) {
        var column = this.matrix.visibleColumns[i];
        if (!column.hasVisibleCell) continue;
        if (column.isShowInMultipleColumns) {
          this.createMutlipleColumnsHeader(column);
        } else {
          this.headerRow.cells.push(this.createHeaderCell(column));
        }
      }
    } else {
      var rows = this.matrix.visibleRows;
      for (var i = 0; i < rows.length; i++) {
        this.headerRow.cells.push(this.createTextCell(rows[i].locText));
      }
      if (this.matrix.hasFooter) {
        this.headerRow.cells.push(
          this.createTextCell(this.matrix.getFooterText())
        );
      }
    }
    if (this.hasActionCellInRows("end")) {
      this.headerRow.cells.push(this.createHeaderCell(null));
    }
  }
  protected buildFooter() {
    if (!this.showFooter) return;
    this.footerRowValue = new QuestionMatrixDropdownRenderedRow();
    if (this.hasActionCellInRows("start")) {
      this.footerRow.cells.push(this.createHeaderCell(null));
    }
    if (this.matrix.hasRowText) {
      this.footerRow.cells.push(
        this.createTextCell(this.matrix.getFooterText())
      );
    }
    var cells = this.matrix.visibleTotalRow.cells;
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      if (!cell.column.hasVisibleCell) continue;
      if (cell.column.isShowInMultipleColumns) {
        this.createMutlipleColumnsFooter(this.footerRow, cell);
      } else {
        this.footerRow.cells.push(this.createEditCell(cell));
      }
    }
    if (this.hasActionCellInRows("end")) {
      this.footerRow.cells.push(this.createHeaderCell(null));
    }
  }
  protected buildRows() {
    var rows = this.matrix.isColumnLayoutHorizontal
      ? this.buildHorizontalRows()
      : this.buildVerticalRows();
    this.setPropertyValue("rows", rows);
  }
  private hasActionCellInRowsValues: any = {};
  private hasActionCellInRows(location: "start" | "end"): boolean {
    if (this.hasActionCellInRowsValues[location] === undefined) {
      var rows = this.matrix.visibleRows;
      this.hasActionCellInRowsValues[location] = false;
      for (var i = 0; i < rows.length; i++) {
        if (!this.isValueEmpty(this.getRowActions(i, location))) {
          this.hasActionCellInRowsValues[location] = true;
          break;
        }
      }
    }
    return this.hasActionCellInRowsValues[location];
  }
  private canRemoveRow(row: MatrixDropdownRowModelBase): boolean {
    return this.matrix.canRemoveRow(row);
  }
  private buildHorizontalRows(): Array<QuestionMatrixDropdownRenderedRow> {
    var rows = this.matrix.visibleRows;
    var renderedRows: Array<QuestionMatrixDropdownRenderedRow> = [];
    for (var i = 0; i < rows.length; i++) {
      this.addHorizontalRow(
        renderedRows,
        rows[i],
        i == 0 && !this.matrix.showHeader
      );
    }
    return renderedRows;
  }
  private addHorizontalRow(
    renderedRows: Array<QuestionMatrixDropdownRenderedRow>,
    row: MatrixDropdownRowModelBase,
    useAsHeader: boolean
  ) {
    var renderedRow = this.createHorizontalRow(row, useAsHeader);
    renderedRow.row = row;
    renderedRows.push(renderedRow);
    if (row.isDetailPanelShowing) {
      renderedRows.push(this.createDetailPanelRow(row, renderedRow));
    }
  }
  private getRowActionsCell(rowIndex: number, location: "start" | "end") {
    const rowActions = this.getRowActions(rowIndex, location);
    if (!this.isValueEmpty(rowActions)) {
      var cell = new QuestionMatrixDropdownRenderedCell();
      var itemValue = new ItemValue(rowActions);
      cell.item = itemValue;
      cell.isActionsCell = true;
      cell.className = this.cssClasses.actionsCell;
      cell.row = this.matrix.visibleRows[rowIndex];
      return cell;
    }
    return null;
  }
  private getRowActions(rowIndex: number, location: "start" | "end") {
    var actions = this.rowsActions[rowIndex];
    if (!Array.isArray(actions)) return [];
    return actions.filter((action) => {
      if (!action.location) {
        action.location = "start";
      }
      return action.location === location;
    });
  }
  private buildRowActions(
    row: MatrixDropdownRowModelBase
  ): Array<IActionBarItem> {
    var actions: Array<IActionBarItem> = [];
    this.setDefaultRowActions(row, actions);
    if (!!this.matrix.survey) {
      actions = this.matrix.survey.getUpdatedMatrixRowActions(
        this.matrix,
        row,
        actions
      );
    }
    return actions;
  }
  private setDefaultRowActions(
    row: MatrixDropdownRowModelBase,
    actions: Array<IActionBarItem>
  ) {
    if (this.hasRemoveRows && this.canRemoveRow(row)) {
      actions.push(
        new ActionBarItem({
          id: "remove-row",
          location: "end",
          enabled: !this.matrix.isInputReadOnly,
          component: "sv-matrix-remove-button",
          data: { row: row, question: this.matrix },
        })
      );
    }
    if (row.hasPanel) {
      actions.push(
        new ActionBarItem({
          id: "show-detail",
          location: "start",
          component: "sv-matrix-detail-button",
          data: { row: row, question: this.matrix },
        })
      );
    }
  }
  private createHorizontalRow(
    row: MatrixDropdownRowModelBase,
    useAsHeader: boolean
  ): QuestionMatrixDropdownRenderedRow {
    var res = new QuestionMatrixDropdownRenderedRow();
    this.addRowActionsCell(row, res, "start");
    if (this.matrix.hasRowText) {
      var renderedCell = this.createTextCell(row.locText);
      renderedCell.row = row;
      res.cells.push(renderedCell);
      if (useAsHeader) {
        this.setHeaderCellWidth(null, renderedCell);
      }
      if (row.hasPanel && !!this.cssClasses.detailRowText) {
        if (!!renderedCell.className) renderedCell.className += " ";
        renderedCell.className += this.cssClasses.detailRowText;
      }
    }
    for (var i = 0; i < row.cells.length; i++) {
      let cell = row.cells[i];
      if (!cell.column.hasVisibleCell) continue;
      if (cell.column.isShowInMultipleColumns) {
        this.createMutlipleEditCells(res, cell);
      } else {
        var renderedCell = this.createEditCell(cell);
        res.cells.push(renderedCell);
        if (useAsHeader) {
          this.setHeaderCellWidth(cell.column, renderedCell);
        }
      }
    }
    this.addRowActionsCell(row, res, "end");
    return res;
  }
  private addRowActionsCell(
    row: MatrixDropdownRowModelBase,
    renderedRow: QuestionMatrixDropdownRenderedRow,
    location: "start" | "end"
  ) {
    var rowIndex = this.matrix.visibleRows.indexOf(row);
    const actions = this.getRowActionsCell(rowIndex, location);
    if (this.hasActionCellInRows(location)) {
      if (!!actions) renderedRow.cells.push(actions);
      else {
        var cell = new QuestionMatrixDropdownRenderedCell();
        cell.isEmpty = true;
        renderedRow.cells.push(cell);
      }
    }
  }
  private createDetailPanelRow(
    row: MatrixDropdownRowModelBase,
    renderedRow: QuestionMatrixDropdownRenderedRow
  ): QuestionMatrixDropdownRenderedRow {
    var res = new QuestionMatrixDropdownRenderedRow();
    res.row = row;
    res.className += this.cssClasses.detailRow;
    res.isDetailRow = true;
    var buttonCell = new QuestionMatrixDropdownRenderedCell();
    if (this.matrix.hasRowText) {
      buttonCell.colSpans = 2;
    }
    buttonCell.isEmpty = true;
    res.cells.push(buttonCell);
    var actionsCell = null;
    if (this.hasActionCellInRows("end")) {
      actionsCell = new QuestionMatrixDropdownRenderedCell();
      actionsCell.isEmpty = true;
    }
    var cell = new QuestionMatrixDropdownRenderedCell();
    cell.panel = row.detailPanel;
    cell.colSpans =
      renderedRow.cells.length -
      buttonCell.colSpans -
      (!!actionsCell ? actionsCell.colSpans : 0);
    cell.className = this.cssClasses.detailPanelCell;
    res.cells.push(cell);
    if (!!actionsCell) {
      res.cells.push(actionsCell);
    }
    if (
      typeof this.matrix.onCreateDetailPanelRenderedRowCallback === "function"
    ) {
      this.matrix.onCreateDetailPanelRenderedRowCallback(res);
    }
    return res;
  }

  private buildVerticalRows(): Array<QuestionMatrixDropdownRenderedRow> {
    var columns = this.matrix.columns;
    var renderedRows = [];
    for (var i = 0; i < columns.length; i++) {
      var col = columns[i];
      if (col.isVisible && col.hasVisibleCell) {
        if (col.isShowInMultipleColumns) {
          this.createMutlipleVerticalRows(renderedRows, col, i);
        } else {
          renderedRows.push(this.createVerticalRow(col, i));
        }
      }
    }
    if (this.hasActionCellInRows("end")) {
      renderedRows.push(this.createEndVerticalActionRow());
    }
    return renderedRows;
  }
  private createMutlipleVerticalRows(
    renderedRows: Array<QuestionMatrixDropdownRenderedRow>,
    column: MatrixDropdownColumn,
    index: number
  ) {
    var choices = this.getMultipleColumnChoices(column);
    if (!choices) return;
    for (var i = 0; i < choices.length; i++) {
      renderedRows.push(this.createVerticalRow(column, index, choices[i], i));
    }
  }
  private createVerticalRow(
    column: MatrixDropdownColumn,
    index: number,
    choice: ItemValue = null,
    choiceIndex: number = -1
  ): QuestionMatrixDropdownRenderedRow {
    var res = new QuestionMatrixDropdownRenderedRow();
    if (this.matrix.showHeader) {
      var lTitle = !!choice ? choice.locText : column.locTitle;
      var hCell = this.createTextCell(lTitle);
      hCell.column = column;
      if (!choice) {
        this.setRequriedToHeaderCell(column, hCell);
      }
      res.cells.push(hCell);
    }
    var rows = this.matrix.visibleRows;
    for (var i = 0; i < rows.length; i++) {
      var rChoice = choice;
      var rChoiceIndex = choiceIndex >= 0 ? choiceIndex : i;
      var cell = rows[i].cells[index];
      var visChoices = !!choice ? cell.question.visibleChoices : undefined;
      if (!!visChoices && rChoiceIndex < visChoices.length) {
        rChoice = visChoices[rChoiceIndex];
      }
      var rCell = this.createEditCell(cell, rChoice);
      rCell.item = rChoice;
      rCell.choiceIndex = rChoiceIndex;
      res.cells.push(rCell);
    }
    if (this.matrix.hasTotal) {
      res.cells.push(
        this.createEditCell(this.matrix.visibleTotalRow.cells[index])
      );
    }

    return res;
  }
  private createEndVerticalActionRow(): QuestionMatrixDropdownRenderedRow {
    var res = new QuestionMatrixDropdownRenderedRow();
    if (this.matrix.showHeader) {
      res.cells.push(this.createTextCell(null));
    }
    var rows = this.matrix.visibleRows;
    for (var i = 0; i < rows.length; i++) {
      res.cells.push(this.getRowActionsCell(i, "end"));
    }
    if (this.matrix.hasTotal) {
      res.cells.push(this.createTextCell(null));
    }
    return res;
  }
  private createMutlipleEditCells(
    rRow: QuestionMatrixDropdownRenderedRow,
    cell: MatrixDropdownCell,
    isFooter: boolean = false
  ) {
    var choices = isFooter
      ? this.getMultipleColumnChoices(cell.column)
      : cell.question.visibleChoices;
    if (!choices) return;
    for (var i = 0; i < choices.length; i++) {
      var rCell = this.createEditCell(cell, !isFooter ? choices[i] : undefined);
      if (!isFooter) {
        //rCell.item = choices[i];
        rCell.choiceIndex = i;
      }
      rRow.cells.push(rCell);
    }
  }
  private createEditCell(
    cell: MatrixDropdownCell,
    choiceItem: any = undefined
  ): QuestionMatrixDropdownRenderedCell {
    var res = new QuestionMatrixDropdownRenderedCell();
    res.cell = cell;
    res.row = cell.row;
    res.question = cell.question;
    res.matrix = this.matrix;
    res.item = choiceItem;

    res.className = res.calculateFinalClassName(this.cssClasses);
    //res.css = res.calcCss(this.cssClasses.cell);

    // var questionCss = cell.question.cssClasses;
    // var className = "";
    // if (!!questionCss) {
    //   className = "";
    //   if (!!questionCss.itemValue) {
    //     className += " " + questionCss.itemValue;
    //   }
    //   if (!!questionCss.asCell) {
    //     if (!!className) className += "";
    //     className += questionCss.asCell;
    //   }
    // }
    // if (!className && !!this.cssClasses.cell) {
    //   className = this.cssClasses.cell;
    // }
    //res.className = className;
    return res;
  }
  private createMutlipleColumnsFooter(
    rRow: QuestionMatrixDropdownRenderedRow,
    cell: MatrixDropdownCell
  ) {
    this.createMutlipleEditCells(rRow, cell, true);
  }
  private createMutlipleColumnsHeader(column: MatrixDropdownColumn) {
    var choices = this.getMultipleColumnChoices(column);
    if (!choices) return;
    for (var i = 0; i < choices.length; i++) {
      var cell = this.createTextCell(choices[i].locText);
      this.setHeaderCell(column, cell);
      this.headerRow.cells.push(cell);
    }
  }
  private getMultipleColumnChoices(column: MatrixDropdownColumn): any {
    var choices = column.templateQuestion.choices;
    if (!!choices && Array.isArray(choices) && choices.length == 0)
      return this.matrix.choices;
    choices = column.templateQuestion.visibleChoices;
    if (!choices || !Array.isArray(choices)) return null;
    return choices;
  }
  private createHeaderCell(
    column: MatrixDropdownColumn
  ): QuestionMatrixDropdownRenderedCell {
    var cell = this.createTextCell(!!column ? column.locTitle : null);
    cell.column = column;
    this.setHeaderCell(column, cell);
    if (this.cssClasses.headerCell) {
      cell.className = this.cssClasses.headerCell;
    }
    return cell;
  }
  private setHeaderCell(
    column: MatrixDropdownColumn,
    cell: QuestionMatrixDropdownRenderedCell
  ) {
    this.setHeaderCellWidth(column, cell);
    this.setRequriedToHeaderCell(column, cell);
  }
  private setHeaderCellWidth(
    column: MatrixDropdownColumn,
    cell: QuestionMatrixDropdownRenderedCell
  ) {
    cell.minWidth = column != null ? this.matrix.getColumnWidth(column) : "";
    cell.width = column != null ? column.width : this.matrix.getRowTitleWidth();
  }
  private setRequriedToHeaderCell(
    column: MatrixDropdownColumn,
    cell: QuestionMatrixDropdownRenderedCell
  ) {
    if (!!column && column.isRequired && this.matrix.survey) {
      cell.requiredText = this.matrix.survey.requiredText;
    }
  }
  private createRemoveRowCell(
    row: MatrixDropdownRowModelBase
  ): QuestionMatrixDropdownRenderedCell {
    var res = new QuestionMatrixDropdownRenderedCell();
    res.row = row;
    res.isRemoveRow = this.canRemoveRow(row);
    if (!!this.cssClasses.cell) {
      res.className = this.cssClasses.cell;
    }
    return res;
  }
  private createTextCell(
    locTitle: LocalizableString
  ): QuestionMatrixDropdownRenderedCell {
    var cell = new QuestionMatrixDropdownRenderedCell();
    cell.locTitle = locTitle;
    if (!!this.cssClasses.cell) {
      cell.className = this.cssClasses.cell;
    }
    return cell;
  }
}

/**
 * A base class for matrix dropdown and matrix dynamic questions.
 */
export class QuestionMatrixDropdownModelBase
  extends QuestionMatrixBaseModel<
    MatrixDropdownRowModelBase,
    MatrixDropdownColumn
  >
  implements IMatrixDropdownData {
  public static get defaultCellType() {
    return settings.matrixDefaultCellType;
  }
  public static set defaultCellType(val: string) {
    settings.matrixDefaultCellType = val;
  }
  public static addDefaultColumns(matrix: QuestionMatrixDropdownModelBase) {
    var colNames = QuestionFactory.DefaultColums;
    for (var i = 0; i < colNames.length; i++) matrix.addColumn(colNames[i]);
  }
  private detailPanelValue: PanelModel;
  protected isRowChanging = false;
  columnsChangedCallback: () => void;
  onRenderedTableResetCallback: () => void;
  onRenderedTableCreatedCallback: (
    table: QuestionMatrixDropdownRenderedTable
  ) => void;
  onCellCreatedCallback: (options: any) => void;
  onCellValueChangedCallback: (options: any) => void;
  onHasDetailPanelCallback: (row: MatrixDropdownRowModelBase) => boolean;
  onCreateDetailPanelCallback: (
    row: MatrixDropdownRowModelBase,
    panel: PanelModel
  ) => void;
  onCreateDetailPanelRenderedRowCallback: (
    renderedRow: QuestionMatrixDropdownRenderedRow
  ) => void;

  protected createColumnValues() {
    return this.createNewArray(
      "columns",
      (item: any) => {
        item.colOwner = this;
      },
      (item: any) => {
        item.colOwner = null;
      }
    );
  }

  constructor(name: string) {
    super(name);
    this.createItemValues("choices");
    this.createLocalizableString("optionsCaption", this);
    this.createLocalizableString("keyDuplicationError", this);
    this.detailPanelValue = this.createNewDetailPanel();
    this.detailPanel.selectedElementInDesign = this;
    this.detailPanel.renderWidth = "100%";
    this.registerFunctionOnPropertyValueChanged(
      "columns",
      (newColumns: any) => {
        this.updateColumnsIndexes(newColumns);
        this.generatedTotalRow = null;
        this.clearRowsAndResetRenderedTable();
      }
    );
    this.registerFunctionOnPropertyValueChanged("cellType", () => {
      this.updateColumnsCellType();
      this.clearRowsAndResetRenderedTable();
    });
    this.registerFunctionOnPropertiesValueChanged(
      ["optionsCaption", "columnColCount", "rowTitleWidth", "choices"],
      () => {
        this.clearRowsAndResetRenderedTable();
      }
    );
    this.registerFunctionOnPropertiesValueChanged(
      [
        "columnLayout",
        "addRowLocation",
        "hideColumnsIfEmpty",
        "showHeader",
        "minRowCount",
        "isReadOnly",
        "rowCount",
        "hasFooter",
        "detailPanelMode",
      ],
      () => {
        this.resetRenderedTable();
      }
    );
  }
  public getType(): string {
    return "matrixdropdownbase";
  }
  public dispose() {
    super.dispose();
    this.clearGeneratedRows();
  }
  public get hasSingleInput(): boolean {
    return false;
  }
  public get isRowsDynamic(): boolean {
    return false;
  }
  public itemValuePropertyChanged(
    item: ItemValue,
    name: string,
    oldValue: any,
    newValue: any
  ) {
    super.itemValuePropertyChanged(item, name, oldValue, newValue);
    if (item.ownerPropertyName === "choices") {
      this.clearRowsAndResetRenderedTable();
    }
  }
  /**
   * Set columnLayout to 'vertical' to place columns vertically and rows horizontally. It makes sense when we have many columns and few rows.
   * @see columns
   * @see rowCount
   */
  public get columnLayout(): string {
    return this.getPropertyValue("columnLayout");
  }
  public set columnLayout(val: string) {
    this.setPropertyValue("columnLayout", val);
  }
  get columnsLocation(): string {
    return this.columnLayout;
  }
  set columnsLocation(val: string) {
    this.columnLayout = val;
  }
  /**
   * Returns true if columns are located horizontally
   * @see columnLayout
   */
  public get isColumnLayoutHorizontal() {
    return this.columnLayout != "vertical";
  }
  /**
   * Set the value to "underRow" to show the detailPanel under the row.
   */
  public get detailPanelMode(): string {
    return this.getPropertyValue("detailPanelMode", "none");
  }
  public set detailPanelMode(val: string) {
    this.setPropertyValue("detailPanelMode", val);
  }
  /**
   * The detail template Panel. This panel is used as a template on creating detail panel for a row.
   * @see  detailElements
   * @see detailPanelMode
   */
  public get detailPanel(): PanelModel {
    return this.detailPanelValue;
  }
  public getPanel(): IPanel {
    return this.detailPanel;
  }
  /**
   * The template Panel elements, questions and panels.
   * @see  detailPanel
   * @see detailPanelMode
   */
  public get detailElements(): Array<IElement> {
    return this.detailPanel.elements;
  }
  protected createNewDetailPanel(): PanelModel {
    return Serializer.createClass("panel");
  }
  public get hasRowText(): boolean {
    return true;
  }
  public getFooterText(): LocalizableString {
    return null;
  }
  public get canAddRow(): boolean {
    return false;
  }
  public get canRemoveRows(): boolean {
    return false;
  }
  public canRemoveRow(row: MatrixDropdownRowModelBase): boolean {
    return true;
  }
  protected onRowsChanged() {
    this.resetRenderedTable();
    super.onRowsChanged();
  }
  private lockResetRenderedTable: boolean = false;
  protected onStartRowAddingRemoving() {
    this.lockResetRenderedTable = true;
  }
  protected onEndRowAdding() {
    this.lockResetRenderedTable = false;
    if (!this.renderedTable) return;
    if (this.renderedTable.isRequireReset()) {
      this.resetRenderedTable();
    } else {
      this.renderedTable.onAddedRow();
    }
  }
  protected onEndRowRemoving(row: MatrixDropdownRowModelBase) {
    this.lockResetRenderedTable = false;
    if (this.renderedTable.isRequireReset()) {
      this.resetRenderedTable();
    } else {
      if (!!row) {
        this.renderedTable.onRemovedRow(row);
      }
    }
  }
  private get renderedTableValue(): QuestionMatrixDropdownRenderedTable {
    return this.getPropertyValue("renderedTable", null);
  }
  private set renderedTableValue(val: QuestionMatrixDropdownRenderedTable) {
    this.setPropertyValue("renderedTable", val);
  }
  private clearRowsAndResetRenderedTable() {
    this.clearGeneratedRows();
    this.resetRenderedTable();
    this.fireCallback(this.columnsChangedCallback);
  }
  protected resetRenderedTable() {
    if (this.lockResetRenderedTable || this.isLoadingFromJson) return;
    this.renderedTableValue = null;
    this.fireCallback(this.onRenderedTableResetCallback);
  }
  protected clearGeneratedRows() {
    if (!this.generatedVisibleRows) return;
    for (var i = 0; i < this.generatedVisibleRows.length; i++) {
      this.generatedVisibleRows[i].dispose();
    }
    super.clearGeneratedRows();
  }

  public get renderedTable(): QuestionMatrixDropdownRenderedTable {
    if (!this.renderedTableValue) {
      this.renderedTableValue = this.createRenderedTable();
      if (!!this.onRenderedTableCreatedCallback) {
        this.onRenderedTableCreatedCallback(this.renderedTableValue);
      }
    }
    return this.renderedTableValue;
  }
  protected createRenderedTable(): QuestionMatrixDropdownRenderedTable {
    return new QuestionMatrixDropdownRenderedTable(this);
  }
  protected onMatrixRowCreated(row: MatrixDropdownRowModelBase) {
    if (!this.survey) return;
    var options = {
      rowValue: row.value,
      row: row,
      column: <any>null,
      columnName: <any>null,
      cell: <any>null,
      cellQuestion: <any>null,
      value: <any>null,
    };
    for (var i = 0; i < this.visibleColumns.length; i++) {
      options.column = this.visibleColumns[i];
      options.columnName = options.column.name;
      var cell = row.cells[i];
      options.cell = cell;
      options.cellQuestion = cell.question;
      options.value = cell.value;
      if (!!this.onCellCreatedCallback) {
        this.onCellCreatedCallback(options);
      }
      this.survey.matrixCellCreated(this, options);
    }
  }
  /**
   * Use this property to change the default cell type.
   */
  public get cellType(): string {
    return this.getPropertyValue("cellType", settings.matrixDefaultCellType);
  }
  public set cellType(val: string) {
    val = val.toLowerCase();
    this.setPropertyValue("cellType", val);
  }
  private updateColumnsCellType() {
    for (var i = 0; i < this.columns.length; i++) {
      this.columns[i].defaultCellTypeChanged();
    }
  }
  private updateColumnsIndexes(cols: Array<MatrixDropdownColumn>) {
    for (var i = 0; i < cols.length; i++) {
      cols[i].setIndex(i);
    }
  }
  /**
   * The default column count for radiogroup and checkbox  cell types.
   */
  public get columnColCount(): number {
    return this.getPropertyValue("columnColCount", 0);
  }
  public set columnColCount(value: number) {
    if (value < 0 || value > 4) return;
    this.setPropertyValue("columnColCount", value);
  }
  /**
   * Use this property to set the minimum column width.
   */
  public get columnMinWidth(): string {
    return this.getPropertyValue("columnMinWidth", "");
  }
  public set columnMinWidth(val: string) {
    this.setPropertyValue("columnMinWidth", val);
  }
  /**
   * Set this property to true to show the horizontal scroll.
   */
  public get horizontalScroll(): boolean {
    return this.getPropertyValue("horizontalScroll", false);
  }
  public set horizontalScroll(val: boolean) {
    this.setPropertyValue("horizontalScroll", val);
  }
  public getRequiredText(): string {
    return this.survey ? this.survey.requiredText : "";
  }
  onColumnPropertyChanged(
    column: MatrixDropdownColumn,
    name: string,
    newValue: any
  ) {
    this.updateHasFooter();
    if (!this.generatedVisibleRows) return;
    for (var i = 0; i < this.generatedVisibleRows.length; i++) {
      this.generatedVisibleRows[i].updateCellQuestionOnColumnChanged(
        column,
        name,
        newValue
      );
    }
    if (!!this.generatedTotalRow) {
      this.generatedTotalRow.updateCellQuestionOnColumnChanged(
        column,
        name,
        newValue
      );
    }
    this.onColumnsChanged();
    if (name == "isRequired") {
      this.resetRenderedTable();
    }
    if (column.isShowInMultipleColumns) {
      this.onShowInMultipleColumnsChanged(column);
    }
  }
  onShowInMultipleColumnsChanged(column: MatrixDropdownColumn) {
    this.clearGeneratedRows();
    this.resetRenderedTable();
  }
  onColumnCellTypeChanged(column: MatrixDropdownColumn) {
    this.clearGeneratedRows();
    this.resetRenderedTable();
  }
  public getRowTitleWidth(): string {
    return "";
  }
  public get hasFooter(): boolean {
    return this.getPropertyValue("hasFooter", false);
  }
  public getAddRowLocation(): string {
    return "default";
  }
  public getShowColumnsIfEmpty(): boolean {
    return false;
  }
  protected updateShowTableAndAddRow() {
    if (!!this.renderedTable) {
      this.renderedTable.updateShowTableAndAddRow();
    }
  }
  protected updateHasFooter() {
    this.setPropertyValue("hasFooter", this.hasTotal);
  }
  public get hasTotal(): boolean {
    for (var i = 0; i < this.columns.length; i++) {
      if (this.columns[i].hasTotal) return true;
    }
    return false;
  }
  getCellType(): string {
    return this.cellType;
  }
  public getConditionJson(operator: string = null, path: string = null): any {
    if (!path) return super.getConditionJson();
    var columnName = "";
    for (var i = path.length - 1; i >= 0; i--) {
      if (path[i] == ".") break;
      columnName = path[i] + columnName;
    }
    var column = this.getColumnByName(columnName);
    if (!column) return null;
    var question = column.createCellQuestion(null);
    if (!question) return null;
    return question.getConditionJson(operator);
  }
  public clearIncorrectValues() {
    var rows = this.visibleRows;
    if (!rows) return;
    for (var i = 0; i < rows.length; i++) {
      rows[i].clearIncorrectValues(this.getRowValue(i));
    }
  }
  public clearErrors() {
    super.clearErrors();
    if (!!this.generatedVisibleRows) {
      for (var i = 0; i < this.generatedVisibleRows.length; i++) {
        var row = this.generatedVisibleRows[i];
        for (var j = 0; j < row.cells.length; j++) {
          row.cells[j].question.clearErrors();
        }
      }
    }
  }

  public runCondition(values: HashTable<any>, properties: HashTable<any>) {
    super.runCondition(values, properties);
    var counter = 0;
    var prevTotalValue;
    do {
      prevTotalValue = Helpers.getUnbindValue(this.totalValue);
      this.runCellsCondition(values, properties);
      this.runTotalsCondition(values, properties);
      counter++;
    } while (
      !Helpers.isTwoValueEquals(prevTotalValue, this.totalValue) &&
      counter < 3
    );
  }
  protected shouldRunColumnExpression(): boolean {
    return false;
  }
  protected runCellsCondition(
    values: HashTable<any>,
    properties: HashTable<any>
  ) {
    if (!this.generatedVisibleRows) return;
    var newValues = this.getRowConditionValues(values);
    var rows = this.generatedVisibleRows;
    for (var i = 0; i < rows.length; i++) {
      rows[i].runCondition(newValues, properties);
    }
    this.checkColumnsVisibility();
  }
  private checkColumnsVisibility() {
    var hasChanged = false;
    for (var i = 0; i < this.visibleColumns.length; i++) {
      if (!this.visibleColumns[i].visibleIf) continue;
      hasChanged =
        this.isColumnVisibilityChanged(this.visibleColumns[i]) || hasChanged;
    }
    if (hasChanged) {
      this.resetRenderedTable();
    }
  }
  private isColumnVisibilityChanged(column: MatrixDropdownColumn): boolean {
    var curVis = column.hasVisibleCell;
    var hasVisCell = false;
    var rows = this.generatedVisibleRows;
    for (var i = 0; i < rows.length; i++) {
      var cell = rows[i].cells[column.index];
      if (!!cell && !!cell.question && cell.question.isVisible) {
        hasVisCell = true;
        break;
      }
    }
    if (curVis != hasVisCell) {
      column.hasVisibleCell = hasVisCell;
    }
    return curVis != hasVisCell;
  }
  protected runTotalsCondition(
    values: HashTable<any>,
    properties: HashTable<any>
  ) {
    if (!this.generatedTotalRow) return;
    this.generatedTotalRow.runCondition(
      this.getRowConditionValues(values),
      properties
    );
  }
  private getRowConditionValues(values: HashTable<any>): HashTable<any> {
    var newValues = values;
    if (!newValues) newValues = {};
    /*
    var newValues: { [index: string]: any } = {};
    if (values && values instanceof Object) {
      newValues = JSON.parse(JSON.stringify(values));
    }
    */
    var totalRow = {};
    if (!this.isValueEmpty(this.totalValue)) {
      totalRow = JSON.parse(JSON.stringify(this.totalValue));
    }
    newValues["row"] = {};
    newValues["totalRow"] = totalRow;
    return newValues;
  }
  public locStrsChanged() {
    super.locStrsChanged();
    var columns = this.columns;
    for (var i = 0; i < columns.length; i++) {
      columns[i].locStrsChanged();
    }
    var rows = this.generatedVisibleRows;
    if (!rows) return;
    for (var i = 0; i < rows.length; i++) {
      rows[i].locStrsChanged();
    }
    if (!!this.generatedTotalRow) {
      this.generatedTotalRow.locStrsChanged();
    }
  }
  /**
   * Returns the column by it's name. Returns null if a column with this name doesn't exist.
   * @param column
   */
  public getColumnByName(columnName: string): MatrixDropdownColumn {
    for (var i = 0; i < this.columns.length; i++) {
      if (this.columns[i].name == columnName) return this.columns[i];
    }
    return null;
  }
  getColumnName(columnName: string): MatrixDropdownColumn {
    return this.getColumnByName(columnName);
  }
  /**
   * Returns the column width.
   * @param column
   */
  public getColumnWidth(column: MatrixDropdownColumn): string {
    return column.minWidth ? column.minWidth : this.columnMinWidth;
  }
  /**
   * The default choices for dropdown, checkbox and radiogroup cell types.
   */
  public get choices(): Array<any> {
    return this.getPropertyValue("choices");
  }
  public set choices(val: Array<any>) {
    this.setPropertyValue("choices", val);
  }
  /**
   * The default options caption for dropdown cell type.
   */
  public get optionsCaption() {
    return this.getLocalizableStringText(
      "optionsCaption",
      surveyLocalization.getString("optionsCaption")
    );
  }
  public set optionsCaption(val: string) {
    this.setLocalizableStringText("optionsCaption", val);
  }
  public get locOptionsCaption() {
    return this.getLocalizableString("optionsCaption");
  }
  /**
   * The duplication value error text. Set it to show the text different from the default.
   * @see MatrixDropdownColumn.isUnique
   */
  public get keyDuplicationError() {
    return this.getLocalizableStringText(
      "keyDuplicationError",
      surveyLocalization.getString("keyDuplicationError")
    );
  }
  public set keyDuplicationError(val: string) {
    this.setLocalizableStringText("keyDuplicationError", val);
  }
  get locKeyDuplicationError() {
    return this.getLocalizableString("keyDuplicationError");
  }
  public get storeOthersAsComment(): boolean {
    return !!this.survey ? this.survey.storeOthersAsComment : false;
  }
  public addColumn(name: string, title: string = null): MatrixDropdownColumn {
    var column = new MatrixDropdownColumn(name, title);
    this.columns.push(column);
    return column;
  }
  protected getVisibleRows(): Array<MatrixDropdownRowModelBase> {
    if (this.isLoadingFromJson) return null;
    if (!this.generatedVisibleRows) {
      this.generatedVisibleRows = this.generateRows();
      this.generatedVisibleRows.forEach((row) => this.onMatrixRowCreated(row));
      if (this.data) {
        this.runCellsCondition(
          this.data.getFilteredValues(),
          this.data.getFilteredProperties()
        );
      }
      this.updateValueOnRowsGeneration(this.generatedVisibleRows);
      this.updateIsAnswered();
    }
    return this.generatedVisibleRows;
  }
  private updateValueOnRowsGeneration(rows: Array<MatrixDropdownRowModelBase>) {
    var oldValue = this.createNewValue(true);
    var newValue = this.createNewValue();
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (!!row.editingObj) continue;
      var rowValue = this.getRowValue(i);
      var rValue = row.value;
      if (this.isTwoValueEquals(rowValue, rValue)) continue;
      newValue = this.getNewValueOnRowChanged(row, "", rValue, false, newValue)
        .value;
    }
    if (this.isTwoValueEquals(oldValue, newValue)) return;
    this.isRowChanging = true;
    this.setNewValue(newValue);
    this.isRowChanging = false;
  }
  public get totalValue(): any {
    if (!this.hasTotal || !this.visibleTotalRow) return {};
    return this.visibleTotalRow.value;
  }
  protected getVisibleTotalRow(): MatrixDropdownRowModelBase {
    if (this.isLoadingFromJson) return null;
    if (this.hasTotal) {
      if (!this.generatedTotalRow) {
        this.generatedTotalRow = this.generateTotalRow();
        if (this.data) {
          var properties = { survey: this.survey };
          this.runTotalsCondition(this.data.getAllValues(), properties);
        }
      }
    } else {
      this.generatedTotalRow = null;
    }
    return this.generatedTotalRow;
  }
  public get visibleTotalRow(): MatrixDropdownRowModelBase {
    return this.getVisibleTotalRow();
  }
  public onSurveyLoad() {
    super.onSurveyLoad();
    this.updateColumnsIndexes(this.columns);
    this.clearGeneratedRows();
    this.generatedTotalRow = null;
    this.updateHasFooter();
  }
  /**
   * Returns the row value. If the row value is empty, the object is empty: {}.
   * @param rowIndex row index from 0 to visible row count - 1.
   */
  public getRowValue(rowIndex: number) {
    if (rowIndex < 0) return null;
    var visRows = this.visibleRows;
    if (rowIndex >= visRows.length) return null;
    var newValue = this.createNewValue();
    return this.getRowValueCore(visRows[rowIndex], newValue);
  }
  public checkIfValueInRowDuplicated(
    checkedRow: MatrixDropdownRowModelBase,
    cellQuestion: Question
  ): boolean {
    if (!this.generatedVisibleRows) return false;
    var res = false;
    for (var i = 0; i < this.generatedVisibleRows.length; i++) {
      var row = this.generatedVisibleRows[i];
      if (checkedRow === row) continue;
      if (row.getValue(cellQuestion.name) == cellQuestion.value) {
        res = true;
        break;
      }
    }
    if (res) {
      this.addDuplicationError(cellQuestion);
    } else {
      cellQuestion.clearErrors();
    }
    return res;
  }
  /**
   * Set the row value.
   * @param rowIndex row index from 0 to visible row count - 1.
   * @param rowValue an object {"column name": columnValue,... }
   */
  public setRowValue(rowIndex: number, rowValue: any): any {
    if (rowIndex < 0) return null;
    var visRows = this.visibleRows;
    if (rowIndex >= visRows.length) return null;
    visRows[rowIndex].value = rowValue;
    this.onRowChanged(visRows[rowIndex], "", rowValue, false);
  }
  protected generateRows(): Array<MatrixDropdownRowModelBase> {
    return null;
  }
  protected generateTotalRow(): MatrixDropdownRowModelBase {
    return new MatrixDropdownTotalRowModel(this);
  }
  protected createNewValue(nullOnEmpty: boolean = false): any {
    var res = !this.value ? {} : this.createValueCopy();
    if (nullOnEmpty && this.isMatrixValueEmpty(res)) return null;
    return res;
  }
  protected getRowValueCore(
    row: MatrixDropdownRowModelBase,
    questionValue: any,
    create: boolean = false
  ): any {
    var result =
      !!questionValue && !!questionValue[row.rowName]
        ? questionValue[row.rowName]
        : null;
    if (!result && create) {
      result = {};
      if (!!questionValue) {
        questionValue[row.rowName] = result;
      }
    }
    return result;
  }
  protected getRowObj(row: MatrixDropdownRowModelBase): any {
    var obj = this.getRowValueCore(row, this.value);
    return !!obj && !!obj.getType ? obj : null;
  }
  protected getRowDisplayValue(
    keysAsText: boolean,
    row: MatrixDropdownRowModelBase,
    rowValue: any
  ): any {
    if (!rowValue) return rowValue;
    if (!!row.editingObj) return rowValue;
    var keys = Object.keys(rowValue);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var question = row.getQuestionByName(key);
      if (!question) {
        question = this.getSharedQuestionByName(key, row);
      }
      if (!!question) {
        var displayvalue = question.getDisplayValue(keysAsText, rowValue[key]);
        if (keysAsText && !!question.title && question.title !== key) {
          rowValue[question.title] = displayvalue;
          delete rowValue[key];
        } else {
          rowValue[key] = displayvalue;
        }
      }
    }
    return rowValue;
  }
  public getPlainData(
    options: {
      includeEmpty?: boolean;
      calculations?: Array<{
        propertyName: string;
      }>;
    } = {
      includeEmpty: true,
    }
  ) {
    var questionPlainData = super.getPlainData(options);
    if (!!questionPlainData) {
      questionPlainData.isNode = true;
      questionPlainData.data = this.visibleRows.map(
        (row: MatrixDropdownRowModelBase) => {
          var rowDataItem = <any>{
            name: row.rowName,
            title: row.rowName,
            value: row.value,
            displayValue: this.getRowDisplayValue(false, row, row.value),
            getString: (val: any) =>
              typeof val === "object" ? JSON.stringify(val) : val,
            isNode: true,
            data: row.cells
              .map((cell: MatrixDropdownCell) =>
                cell.question.getPlainData(options)
              )
              .filter((d: any) => !!d),
          };
          (options.calculations || []).forEach((calculation) => {
            rowDataItem[calculation.propertyName] = (<any>row)[
              calculation.propertyName
            ];
          });
          return rowDataItem;
        }
      );
    }
    return questionPlainData;
  }
  public getProgressInfo(): IProgressInfo {
    return SurveyElement.getProgressInfoByElements(
      this.getCellQuestions(),
      this.isRequired
    );
  }
  private getCellQuestions(): Array<Question> {
    const rows = this.visibleRows;
    if (!rows) return [];
    const questions = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      for (let j = 0; j < row.cells.length; j++) {
        questions.push(row.cells[j].question);
      }
    }
    return questions;
  }

  protected onBeforeValueChanged(val: any) {}
  private onSetQuestionValue() {
    if (this.isRowChanging) return;
    this.onBeforeValueChanged(this.value);
    if (!this.generatedVisibleRows || this.generatedVisibleRows.length == 0)
      return;
    this.isRowChanging = true;
    var val = this.createNewValue();
    for (var i = 0; i < this.generatedVisibleRows.length; i++) {
      var row = this.generatedVisibleRows[i];
      this.generatedVisibleRows[i].value = this.getRowValueCore(row, val);
    }
    this.isRowChanging = false;
  }
  protected setQuestionValue(newValue: any) {
    super.setQuestionValue(newValue, false);
    this.onSetQuestionValue();
    this.updateIsAnswered();
  }
  supportGoNextPageAutomatic() {
    var rows = this.generatedVisibleRows;
    if (!rows) rows = this.visibleRows;
    if (!rows) return true;
    for (var i = 0; i < rows.length; i++) {
      var cells = this.generatedVisibleRows[i].cells;
      if (!cells) continue;
      for (var colIndex = 0; colIndex < cells.length; colIndex++) {
        var question = cells[colIndex].question;
        if (
          question &&
          (!question.supportGoNextPageAutomatic() || !question.value)
        )
          return false;
      }
    }
    return true;
  }
  protected getContainsErrors(): boolean {
    return (
      super.getContainsErrors() ||
      this.checkForAnswersOrErrors(
        (question: Question) => question.containsErrors,
        false
      )
    );
  }
  protected getIsAnswered(): boolean {
    return (
      super.getIsAnswered() &&
      this.checkForAnswersOrErrors(
        (question: Question) => question.isAnswered,
        true
      )
    );
  }
  private checkForAnswersOrErrors(
    predicate: (question: Question) => boolean,
    every: boolean = false
  ) {
    var rows = this.generatedVisibleRows;
    if (!rows) return false;
    for (var i = 0; i < rows.length; i++) {
      var cells = rows[i].cells;
      if (!cells) continue;
      for (var colIndex = 0; colIndex < cells.length; colIndex++) {
        if (!cells[colIndex]) continue;
        var question = cells[colIndex].question;
        if (question && question.isVisible)
          if (predicate(question)) {
            if (!every) return true;
          } else {
            if (every) return false;
          }
      }
    }
    return every ? true : false;
  }
  public hasErrors(fireCallback: boolean = true, rec: any = null): boolean {
    var errosInRows = this.hasErrorInRows(fireCallback, rec);
    var isDuplicated = this.isValueDuplicated();
    return super.hasErrors(fireCallback, rec) || errosInRows || isDuplicated;
  }
  protected getIsRunningValidators(): boolean {
    if (super.getIsRunningValidators()) return true;
    if (!this.generatedVisibleRows) return false;
    for (var i = 0; i < this.generatedVisibleRows.length; i++) {
      var cells = this.generatedVisibleRows[i].cells;
      if (!cells) continue;
      for (var colIndex = 0; colIndex < cells.length; colIndex++) {
        if (!cells[colIndex]) continue;
        var question = cells[colIndex].question;
        if (!!question && question.isRunningValidators) return true;
      }
    }
    return false;
  }
  public getAllErrors(): Array<SurveyError> {
    var result = super.getAllErrors();
    var rows = this.generatedVisibleRows;

    if (rows === null) return result;

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      for (var j = 0; j < row.cells.length; j++) {
        var errors = row.cells[j].question.getAllErrors();
        if (errors && errors.length > 0) {
          result = result.concat(errors);
        }
      }
    }
    return result;
  }
  private hasErrorInRows(fireCallback: boolean, rec: any): boolean {
    if (!this.generatedVisibleRows) return false;
    var res = false;
    if (!rec) rec = {};
    rec.isSingleDetailPanel = this.detailPanelMode === "underRowSingle";
    for (var i = 0; i < this.generatedVisibleRows.length; i++) {
      res =
        this.generatedVisibleRows[i].hasErrors(fireCallback, rec, () => {
          this.raiseOnCompletedAsyncValidators();
        }) || res;
    }
    return res;
  }
  private isValueDuplicated(): boolean {
    if (!this.generatedVisibleRows) return false;
    var columns = this.getUniqueColumns();
    var res = false;
    for (var i = 0; i < columns.length; i++) {
      res = this.isValueInColumnDuplicated(columns[i]) || res;
    }
    return res;
  }
  private isValueInColumnDuplicated(column: MatrixDropdownColumn): boolean {
    var keyValues = <Array<any>>[];
    var res = false;
    for (var i = 0; i < this.generatedVisibleRows.length; i++) {
      res =
        this.isValueDuplicatedInRow(
          this.generatedVisibleRows[i],
          column,
          keyValues
        ) || res;
    }
    return res;
  }
  protected getUniqueColumns(): Array<MatrixDropdownColumn> {
    var res = new Array<MatrixDropdownColumn>();
    for (var i = 0; i < this.columns.length; i++) {
      if (this.columns[i].isUnique) {
        res.push(this.columns[i]);
      }
    }
    return res;
  }
  private isValueDuplicatedInRow(
    row: MatrixDropdownRowModelBase,
    column: MatrixDropdownColumn,
    keyValues: Array<any>
  ): boolean {
    var question = row.getQuestionByColumn(column);
    if (!question || question.isEmpty()) return false;
    var value = question.value;
    for (var i = 0; i < keyValues.length; i++) {
      if (value == keyValues[i]) {
        this.addDuplicationError(question);
        return true;
      }
    }
    keyValues.push(value);
    return false;
  }
  private addDuplicationError(question: Question) {
    question.addError(new KeyDuplicationError(this.keyDuplicationError, this));
  }
  protected getFirstInputElementId(): string {
    var question = this.getFirstCellQuestion(false);
    return question ? question.inputId : super.getFirstInputElementId();
  }
  protected getFirstErrorInputElementId(): string {
    var question = this.getFirstCellQuestion(true);
    return question ? question.inputId : super.getFirstErrorInputElementId();
  }
  protected getFirstCellQuestion(onError: boolean): Question {
    if (!this.generatedVisibleRows) return null;
    for (var i = 0; i < this.generatedVisibleRows.length; i++) {
      var cells = this.generatedVisibleRows[i].cells;
      for (var colIndex = 0; colIndex < cells.length; colIndex++) {
        if (!onError) return cells[colIndex].question;
        if (cells[colIndex].question.currentErrorCount > 0)
          return cells[colIndex].question;
      }
    }
    return null;
  }
  protected onReadOnlyChanged() {
    super.onReadOnlyChanged();
    if (!this.generateRows) return;
    for (var i = 0; i < this.visibleRows.length; i++) {
      this.visibleRows[i].onQuestionReadOnlyChanged(this.isReadOnly);
    }
  }

  //IMatrixDropdownData
  public createQuestion(
    row: MatrixDropdownRowModelBase,
    column: MatrixDropdownColumn
  ): Question {
    return this.createQuestionCore(row, column);
  }
  protected createQuestionCore(
    row: MatrixDropdownRowModelBase,
    column: MatrixDropdownColumn
  ): Question {
    var question = column.createCellQuestion(row);
    if (this.isReadOnly) {
      question.readOnly = true;
    }
    question.setSurveyImpl(row);
    question.setParentQuestion(this);
    return question;
  }
  protected deleteRowValue(
    newValue: any,
    row: MatrixDropdownRowModelBase
  ): any {
    if (!newValue) return newValue;
    delete newValue[row.rowName];
    return this.isObject(newValue) && Object.keys(newValue).length == 0
      ? null
      : newValue;
  }
  private isDoingonAnyValueChanged = false;
  onAnyValueChanged(name: string) {
    if (
      this.isLoadingFromJson ||
      this.isDoingonAnyValueChanged ||
      !this.generatedVisibleRows
    )
      return;
    this.isDoingonAnyValueChanged = true;
    var rows = this.visibleRows;
    for (var i = 0; i < rows.length; i++) {
      rows[i].onAnyValueChanged(name);
    }
    var totalRow = this.visibleTotalRow;
    if (!!totalRow) {
      totalRow.onAnyValueChanged(name);
    }
    this.isDoingonAnyValueChanged = false;
  }
  protected isObject(value: any) {
    return value !== null && typeof value === "object";
  }
  private getOnCellValueChangedOptions(
    row: MatrixDropdownRowModelBase,
    columnName: string,
    rowValue: any
  ): any {
    var getQuestion = (colName: any) => {
      for (var i = 0; i < row.cells.length; i++) {
        var col = row.cells[i].column;
        if (!!col && col.name === colName) {
          return row.cells[i].question;
        }
      }
      return null;
    };
    return {
      row: row,
      columnName: columnName,
      rowValue: rowValue,
      value: !!rowValue ? rowValue[columnName] : null,
      getCellQuestion: getQuestion,
    };
  }
  protected onCellValueChanged(
    row: MatrixDropdownRowModelBase,
    columnName: string,
    rowValue: any
  ) {
    if (!this.survey) return;
    var options = this.getOnCellValueChangedOptions(row, columnName, rowValue);
    if (!!this.onCellValueChangedCallback) {
      this.onCellValueChangedCallback(options);
    }
    this.survey.matrixCellValueChanged(this, options);
  }
  validateCell(
    row: MatrixDropdownRowModelBase,
    columnName: string,
    rowValue: any
  ): SurveyError {
    if (!this.survey) return;
    var options = this.getOnCellValueChangedOptions(row, columnName, rowValue);
    return this.survey.matrixCellValidate(this, options);
  }
  get isValidateOnValueChanging(): boolean {
    return !!this.survey ? this.survey.isValidateOnValueChanging : false;
  }
  onRowChanging(
    row: MatrixDropdownRowModelBase,
    columnName: string,
    rowValue: any
  ): any {
    if (!this.survey) return !!rowValue ? rowValue[columnName] : null;
    var options = this.getOnCellValueChangedOptions(row, columnName, rowValue);
    var oldRowValue = this.getRowValueCore(row, this.createNewValue(), true);
    options.oldValue = !!oldRowValue ? oldRowValue[columnName] : null;
    this.survey.matrixCellValueChanging(this, options);
    return options.value;
  }
  onRowChanged(
    row: MatrixDropdownRowModelBase,
    columnName: string,
    newRowValue: any,
    isDeletingValue: boolean
  ) {
    var rowObj = !!columnName ? this.getRowObj(row) : null;
    if (!!rowObj) {
      var columnValue = null;
      if (!!newRowValue && !isDeletingValue) {
        columnValue = newRowValue[columnName];
      }
      this.isRowChanging = true;
      rowObj[columnName] = columnValue;
      this.isRowChanging = false;
      this.onCellValueChanged(row, columnName, rowObj);
    } else {
      var oldValue = this.createNewValue(true);
      var combine = this.getNewValueOnRowChanged(
        row,
        columnName,
        newRowValue,
        isDeletingValue,
        this.createNewValue()
      );
      if (this.isTwoValueEquals(oldValue, combine.value)) return;
      this.isRowChanging = true;
      this.setNewValue(combine.value);
      this.isRowChanging = false;
      if (columnName) {
        this.onCellValueChanged(row, columnName, combine.rowValue);
      }
    }
  }
  private getNewValueOnRowChanged(
    row: MatrixDropdownRowModelBase,
    columnName: string,
    newRowValue: any,
    isDeletingValue: boolean,
    newValue: any
  ): any {
    var rowValue = this.getRowValueCore(row, newValue, true);
    if (isDeletingValue) {
      delete rowValue[columnName];
    }
    for (var i = 0; i < row.cells.length; i++) {
      var key = row.cells[i].question.getValueName();
      delete rowValue[key];
    }
    if (newRowValue) {
      newRowValue = JSON.parse(JSON.stringify(newRowValue));
      for (var key in newRowValue) {
        if (!this.isValueEmpty(newRowValue[key])) {
          rowValue[key] = newRowValue[key];
        }
      }
    }
    if (this.isObject(rowValue) && Object.keys(rowValue).length === 0) {
      newValue = this.deleteRowValue(newValue, row);
    }
    return { value: newValue, rowValue: rowValue };
  }
  getRowIndex(row: MatrixDropdownRowModelBase): number {
    if (!this.generatedVisibleRows) return -1;
    return this.visibleRows.indexOf(row);
  }
  public getElementsInDesign(includeHidden: boolean = false): Array<IElement> {
    if (this.detailPanelMode == "none")
      return super.getElementsInDesign(includeHidden);
    return includeHidden ? [this.detailPanel] : this.detailElements;
  }
  hasDetailPanel(row: MatrixDropdownRowModelBase): boolean {
    if (this.detailPanelMode == "none") return false;
    if (this.isDesignMode) return true;
    if (!!this.onHasDetailPanelCallback)
      return this.onHasDetailPanelCallback(row);
    return this.detailElements.length > 0;
  }
  getIsDetailPanelShowing(row: MatrixDropdownRowModelBase): boolean {
    if (this.detailPanelMode == "none") return false;
    if (this.isDesignMode) {
      var res = this.visibleRows.indexOf(row) == 0;
      if (res) {
        if (!row.detailPanel) {
          row.showDetailPanel();
        }
      }
      return res;
    }
    return this.getPropertyValue("isRowShowing" + row.id, false);
  }
  setIsDetailPanelShowing(row: MatrixDropdownRowModelBase, val: boolean): void {
    if (val == this.getIsDetailPanelShowing(row)) return;
    this.setPropertyValue("isRowShowing" + row.id, val);
    this.updateDetailPanelButtonCss(row);
    if (!!this.renderedTable) {
      this.renderedTable.onDetailPanelChangeVisibility(row, val);
    }
    if (val && this.detailPanelMode === "underRowSingle") {
      var rows = this.visibleRows;
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].id !== row.id && rows[i].isDetailPanelShowing) {
          rows[i].hideDetailPanel();
        }
      }
    }
  }
  public getDetailPanelButtonCss(row: MatrixDropdownRowModelBase): string {
    var res = this.getPropertyValue("detailButtonCss" + row.id);
    if (!!res) return res;
    var res = this.cssClasses.detailButton;
    return !!res ? res : "";
  }
  public getDetailPanelIconCss(row: MatrixDropdownRowModelBase): string {
    var res = this.getPropertyValue("detailIconCss" + row.id);
    if (!!res) return res;
    var res = this.cssClasses.detailIcon;
    return !!res ? res : "";
  }
  private updateDetailPanelButtonCss(row: MatrixDropdownRowModelBase) {
    var classes = this.cssClasses;
    var icon = classes.detailIcon;
    if (!icon) icon = "";
    var button = classes.detailButton;
    if (!button) button = "";
    if (this.getIsDetailPanelShowing(row)) {
      if (!!classes.detailIconExpanded)
        icon += " " + classes.detailIconExpanded;
      if (!!classes.detailButtonExpanded)
        button += " " + classes.detailButtonExpanded;
    }
    this.setPropertyValue("detailIconCss" + row.id, icon);
    this.setPropertyValue("detailButtonCss" + row.id, button);
  }
  createRowDetailPanel(row: MatrixDropdownRowModelBase): PanelModel {
    if (this.isDesignMode) return this.detailPanel;
    var panel = this.createNewDetailPanel();
    var json = this.detailPanel.toJSON();
    new JsonObject().toObject(json, panel);
    panel.renderWidth = "100%";
    panel.updateCustomWidgets();
    if (!!this.onCreateDetailPanelCallback) {
      this.onCreateDetailPanelCallback(row, panel);
    }
    return panel;
  }
  getSharedQuestionByName(
    columnName: string,
    row: MatrixDropdownRowModelBase
  ): Question {
    if (!this.survey || !this.valueName) return null;
    var index = this.getRowIndex(row);
    if (index < 0) return null;
    return <Question>(
      this.survey.getQuestionByValueNameFromArray(
        this.valueName,
        columnName,
        index
      )
    );
  }
  onTotalValueChanged(): any {
    if (
      !!this.data &&
      !!this.visibleTotalRow &&
      !this.isLoadingFromJson &&
      !this.isSett &&
      !this.isReadOnly
    ) {
      this.data.setValue(
        this.getValueName() + settings.matrixTotalValuePostFix,
        this.totalValue,
        false
      );
    }
  }
  public getQuestionFromArray(name: string, index: number): IQuestion {
    if (index >= this.visibleRows.length) return null;
    return this.visibleRows[index].getQuestionByName(name);
  }
  private isMatrixValueEmpty(val: any) {
    if (!val) return;
    if (Array.isArray(val)) {
      for (var i = 0; i < val.length; i++) {
        if (this.isObject(val[i]) && Object.keys(val[i]).length > 0)
          return false;
      }
      return true;
    }
    return Object.keys(val).length == 0;
  }

  private get SurveyModel() {
    return this.survey as SurveyModel;
  }
  public getCellTemplateData(cell: QuestionMatrixDropdownRenderedCell) {
    // return cell.cell.column.templateQuestion;
    return this.SurveyModel.getMatrixCellTemplateData(cell);
  }
  public getCellWrapperComponentName(cell: MatrixDropdownCell) {
    return this.SurveyModel.getElementWrapperComponentName(cell, "cell");
  }
  public getCellWrapperComponentData(cell: MatrixDropdownCell) {
    return this.SurveyModel.getElementWrapperComponentData(cell, "cell");
  }
  public getColumnHeaderWrapperComponentName(cell: MatrixDropdownCell) {
    return this.SurveyModel.getElementWrapperComponentName(
      cell,
      "column-header"
    );
  }
  public getColumnHeaderWrapperComponentData(cell: MatrixDropdownCell) {
    return this.SurveyModel.getElementWrapperComponentData(
      cell,
      "column-header"
    );
  }
  public getRowHeaderWrapperComponentName(cell: MatrixDropdownCell) {
    return this.SurveyModel.getElementWrapperComponentName(cell, "row-header");
  }
  public getRowHeaderWrapperComponentData(cell: MatrixDropdownCell) {
    return this.SurveyModel.getElementWrapperComponentData(cell, "row-header");
  }
}

Serializer.addClass(
  "matrixdropdowncolumn",
  [
    { name: "!name", isUnique: true },
    { name: "title", serializationProperty: "locTitle" },
    {
      name: "cellType",
      default: "default",
      choices: () => {
        var res = MatrixDropdownColumn.getColumnTypes();
        res.splice(0, 0, "default");
        return res;
      },
    },
    { name: "colCount", default: -1, choices: [-1, 0, 1, 2, 3, 4] },
    "isRequired:boolean",
    "isUnique:boolean",
    {
      name: "requiredErrorText:text",
      serializationProperty: "locRequiredErrorText",
    },
    "readOnly:boolean",
    "minWidth",
    "width",
    "visibleIf:condition",
    "enableIf:condition",
    "requiredIf:condition",
    {
      name: "showInMultipleColumns:boolean",
      dependsOn: "cellType",
      visibleIf: function(obj: any) {
        if (!obj) return false;
        return obj.isSupportMultipleColumns;
      },
    },
    {
      name: "validators:validators",
      baseClassName: "surveyvalidator",
      classNamePart: "validator",
    },
    {
      name: "totalType",
      default: "none",
      choices: ["none", "sum", "count", "min", "max", "avg"],
    },
    "totalExpression:expression",
    { name: "totalFormat", serializationProperty: "locTotalFormat" },
    {
      name: "totalDisplayStyle",
      default: "none",
      choices: ["none", "decimal", "currency", "percent"],
    },
    {
      name: "totalCurrency",
      choices: () => {
        return getCurrecyCodes();
      },
      default: "USD",
    },
    { name: "totalMaximumFractionDigits:number", default: -1 },
    { name: "totalMinimumFractionDigits:number", default: -1 },
    { name: "renderAs", default: "default", visible: false },
  ],
  function() {
    return new MatrixDropdownColumn("");
  }
);

Serializer.addClass(
  "matrixdropdownbase",
  [
    {
      name: "columns:matrixdropdowncolumns",
      className: "matrixdropdowncolumn",
    },
    {
      name: "columnLayout",
      alternativeName: "columnsLocation",
      default: "horizontal",
      choices: ["horizontal", "vertical"],
    },
    {
      name: "detailElements",
      visible: false,
      isLightSerializable: false,
    },
    {
      name: "detailPanelMode",
      choices: ["none", "underRow", "underRowSingle"],
      default: "none",
    },
    "horizontalScroll:boolean",
    {
      name: "choices:itemvalue[]",
    },
    { name: "optionsCaption", serializationProperty: "locOptionsCaption" },
    {
      name: "keyDuplicationError",
      serializationProperty: "locKeyDuplicationError",
    },
    {
      name: "cellType",
      default: "dropdown",
      choices: () => {
        return MatrixDropdownColumn.getColumnTypes();
      },
    },
    { name: "columnColCount", default: 0, choices: [0, 1, 2, 3, 4] },
    "columnMinWidth",
  ],
  function() {
    return new QuestionMatrixDropdownModelBase("");
  },
  "matrixbase"
);
