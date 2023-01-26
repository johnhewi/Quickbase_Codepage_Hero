class record {
    constructor(client, tableId, fieldList) {
        this.tableId = tableId;
        this.fieldList = fieldList;
        this.client = client;
        this.formInstructions = null;
        this.qb_dict = this.getQbValidationData();
        this.forms = []
        this.submitErrors = 0
        this.record = {}
        this.RID_FID = 3
        this.rid = null
        this.lastRecord = null
    }

    // METHODS

    async getQbValidationData() {

        let response = {}
        // get the validation data from the server
        let validationObjects = await this.getValidationDictFromRecord()
        console.log("validationObjects: ", validationObjects)

        for(let key in validationObjects){
            console.log("key: ", key)
            let r = await fetch(`https://api.quickbase.com/v1/fields?tableId=${key}`, {
                method: 'GET',
                headers: this.client.headers,
            })

            let field_data = await r.json()
            console.log("FIELD DATA: ", field_data)
            console.log("first item in field_data: ", field_data[0])
            let fields_to_return = {}
            for (let i = 0; i < field_data.length; i++) {
                let field = field_data[i]
                console.log("field data id from assignment: ", field['id'])
                console.log("field_data[i]['id']: ", field_data[i]['id'])
                console.log("FIELD AFTER ASSIGNMENT: ", field)
                if (field['properties']['primaryKey']) {
                    response['primaryKey'] = field['id'];
                }
                if (validationObjects[key].includes(field['id'])) {
                    console.log("field id: ", field['id'])
                    console.log("field: ", field)
                    fields_to_return[field['id']] = {
                        required: field['required'],
                        fieldType: field['fieldType'],
                        mode: field['mode'],
                        primaryKey: field['properties']['primaryKey'],
                        foreignKey: field['properties']['foreignKey'],
                        label: field['label'],
                    };
                    if ('choices' in field['properties']) {
                        fields_to_return[field['id']]['choices'] = field['properties']['choices'];
                    }
                    if (field['properties']['foreignKey']) {
                        fields_to_return[field['id']]['parentTableID'] = field['properties']['masterTableId'];
                        fields_to_return[field['id']]['parentTableKeyFid'] = field['properties']['masterTableKeyFid'];
                        fields_to_return[field['id']]['foreignKey'] = field['properties']['foreignKey'];
                    }
                }

            }
            response[key] = fields_to_return;
        }
        console.log("response: ", response);
        this.RID_FID = response['primaryKey']
        return response
    }

    async getParentData(formElement) {
        console.log("formElement in getParentData: ", formElement)

        // get the validation data from the server
        let validationObjects = await this.getValidationDictFromRecord()
        let parentData = await fetch(this.validatorObject.endpoint_url, {
            method: 'POST',
            mode: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.validatorObject.csrf_token
            },
            body: JSON.stringify({
                'data': formElement,
                'manner': 'getParentData'
            })
        })
        return parentData.json()
    }


    async getValidationDictFromRecord() {
        // create a dictionary to hold the validation data
        let validationDict = {}
        for (let field of this.fieldList) {
            let table_id = this.tableId
            let field_id = field
            // check if table_id is already a key in validationObjects
            if (table_id in validationDict) {
                // if it is, add field_id to the array
                validationDict[table_id].push(field_id)
            } else {
                // if it isn't, create a new key with the table_id and add the field_id to the array
                validationDict[table_id] = [field_id]
            }
        }
        console.log("validationDict: ", validationDict)
        return validationDict;
    }

    async create_record() {

        console.log("this.values: ", this.values)
        let record = {}
        // loop through elements of this.values
        for (let element of this.values) {
            if(element.value !== ''){
                // split the data-qb attribute into table_id and field_id
                let field_id = element['id'].split('.')[1]
                record[field_id] = { value: element.value }
            }
        }

        record[this.RID_FID] = { value: this.rid }

        console.log("record: ", record)
        this.record = record
    }

    async postNewRecord() {
        let record = await this.record
        let response = await fetch(this.validatorObject.endpoint_url, {
            method: 'POST',
            mode: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.validatorObject.csrf_token
            },
            body: JSON.stringify({
                'data': {
                    'tableID': this.tableId,
                    'data': record
                },
                'manner': 'postRecord'
            })
        })
        let parsedResponse = await response.json()

        console.log("parsedResponse: ", parsedResponse)

        if('metadata' in parsedResponse){
            if('createdRecordIds' in parsedResponse['metadata']){
                this.record[this.RID_FID] = { 'value' : parsedResponse['metadata']['createdRecordIds'][0]}
                // this.rid = parsedResponse['metadata']['createdRecordIds'][0]
            }
        }
        return parsedResponse
    }

    async queryRecords(tableId, select, where, additionalParams={}) {

        let queryData = {
            'tableID': tableId,
            'select': select,
            'where': where
        }

        // if there are any keys in additionalParams, add the key value pairs to data
        if(Object.keys(additionalParams).length > 0){
            queryData = additionalParams
        }

        let response = await fetch(this.validatorObject.endpoint_url, {
            method: 'POST',
            mode: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.validatorObject.csrf_token
            },
            body: JSON.stringify({
                'data': queryData,
                'manner': 'queryRecords'
            })
        })
        return response.json()
    }

    async qb_validate(){
        let validationObjects = await this.get_QB_validation_objects()
        console.log("validationObjects: ", validationObjects)
        this.values = validationObjects
        let isValidated = true;
        // loop through each field
        for (let i = 0; i < validationObjects.length; i++){

            let type = validationObjects[i].data_type;
            // convert type to string

            if (document.getElementById(validationObjects[i].id).hasAttribute('data-helpertext')) {
                isValidated = false;
            }


            //if field is not required and is empty, skip validation
            if (validationObjects[i].value === "" && !validationObjects[i].required){
                console.log("skipping validation for " + validationObjects[i].id);
                continue;
            }

            // check if field is required
            if (validationObjects[i].required){
                // check if field is empty
                if (validationObjects[i].value === ""){
                    addHelperText(validationObjects[i].id, "Field required")
                    isValidated = false;
                }
            }

            if(validationObjects[i].mode === 'formula'){
                isValidated = false;
                addHelperText(validationObjects[i].id, "Cannot upload to a formula field")
                continue
            }

            if(validationObjects[i].mode === 'lookup'){
                isValidated = false;
                addHelperText(validationObjects[i].id, "Cannot upload to a lookup field")
                continue
            }

            if(validationObjects[i].primaryKey === true){
                isValidated = false;
                addHelperText(validationObjects[i].id, "Cannot upload to primary key field")
                continue
            }

            if(validationObjects[i].foreignKey === true){
                if(isInteger(parseInt(validationObjects[i].value)) === false){
                    addHelperText(validationObjects[i].id, "Foreign key must be an integer")
                    continue
                }
            }


            // check if field is text
            if (['text', 'rich-text', 'text-multi-line'].includes(type)){
                if (!isText(validationObjects[i].value)){
                    addHelperText(validationObjects[i].id, "Must be text")
                    isValidated = false;
                }
            }
            // check if field is multiple choice or blank
            if (['text-multiple-choice'].includes(type)){
                console.log("validating multiple choice...");
                console.log("value: ", validationObjects[i].value);
                console.log("choices: ", validationObjects[i].choices);
                if (!isMultipleChoice(validationObjects[i].value, validationObjects[i].choices)){
                    addHelperText(validationObjects[i].id, `"${validationObjects[i].value}" is not a valid choice.`)
                    isValidated = false;
                }
            }
            // check if field is email or blank
            if (type === "email"){
                if (!isEmail(validationObjects[i].value)){
                    addHelperText(validationObjects[i].id, `"${validationObjects[i].value}" is not a valid email`)
                    isValidated = false;
                }
            }
            // check if field is number or blank
            if (["numeric", "currency", "percent"].includes(type)){
                if (!isNumber(validationObjects[i].value)){
                    addHelperText(validationObjects[i].id, "Must be a number")
                    isValidated = false;
                }
            }
            // check if field is date or blank
            if (["date", "timestamp"].includes(type)){
                // check if date is in this format: "2019-12-18T12:00:00.000-04:00"



                if (!isDate(validationObjects[i].value)){
                    addHelperText(validationObjects[i].id, "Must be a valid date")
                    isValidated = false;
                }
            }

            // check if field is phone or blank
            if (["phone"].includes(type)){
                //remove all non-numeric characters
                if (!isPhone(validationObjects[i].value)){
                    addHelperText(validationObjects[i].id, `"${validationObjects[i].value}" is not a valid 10 digit phone number`)
                    isValidated = false;
                }
            }
        }
        return isValidated;
    }

    async get_QB_validation_objects() {
        let qb_dict = await this.qb_dict
        console.log("qb_dict in get_QB_validation_objects: ", qb_dict)
        // array to hold all validation objects
        let validationObjects = []
        // get all fields on the form
        let elements = document.querySelectorAll('[data-qb]')
        Array.from(elements).forEach(function(input) {
            let table_id = input.getAttribute('data-qb').split('.')[0]
            let field_id = parseInt(input.getAttribute('data-qb').split('.')[1])
            console.log("table_id: ", table_id)
            console.log("field_id: ", field_id)
            let fieldObj = {
                id: input.id,
                value: input.value,
                required: qb_dict[table_id][field_id]['required'],
                data_type: qb_dict[table_id][field_id]['fieldType'],
                mode: qb_dict[table_id][field_id]['mode'],
                primaryKey: qb_dict[table_id][field_id]['primaryKey'],
                foreignKey: qb_dict[table_id][field_id]['foreignKey']
            }
            if('choices' in qb_dict[table_id][field_id]){
                fieldObj['choices'] = qb_dict[table_id][field_id]['choices']
            }
            if(input.getAttribute('data-value')){
                fieldObj['value'] = eval(input.getAttribute('data-value'))
            }
            validationObjects.push(fieldObj);
        })
        this.QB_validation_objects = validationObjects
        return validationObjects;
    }

    async buildForm(selectedDivID, formParameters = {}) {

        let selectedDiv = document.getElementById(selectedDivID)
        selectedDiv.id = "form-" + this.tableId + "-" + this.forms.length
        selectedDiv.setAttribute("class", "my_form")

        let formInstructions = await this.getFormInstructions(formParameters);
        this.forms.push(formInstructions)
        console.log("Form Instructions: ", formInstructions)
        if('title' in formParameters){
            let titlerow = document.createElement("div")
            titlerow.setAttribute("class", "form-title-class")
            titlerow.innerHTML = `<div style="font-size: 40px">${formParameters.title}</div>`
            selectedDiv.append(titlerow)
        }
        let lastrow = document.createElement("div")
        let rowcount = 0
        lastrow.classList.add("form-row")
        lastrow.id = "row-" + rowcount

        // loop through the formInstructions list and create the form
        for (let formElement of formInstructions) {
            if(!('sameRow' in formElement) || formElement.sameRow === false){
                lastrow = document.createElement("div")
                rowcount += 1
                lastrow.id = "row-" + rowcount
                lastrow.classList.add("form-row")
            }
            if (formElement.type === "block") {
                let div = await buildBlock(formElement)
                lastrow.append(div)
            } else if (formElement.type === "select") {
                let div = await buildSelectInput(formElement)
                lastrow.append(div)
            }else if (formElement.type === "textarea") {
                let div = await buildTextAreaInput(formElement)
                lastrow.append(div)
            }else if (formElement.foreignKey){
                let div = await buildParentRecordInput(formElement, await this.getParentData(formElement))
                lastrow.append(div)
            }else if (formElement.type === "rating") {
                let div = await buildRatingInput(formElement)
                lastrow.append(div)
            }else {
                let div = await buildInput(formElement)
                lastrow.append(div)
            }
            if(!formElement.sameRow || formElement.sameRow === false){
                selectedDiv.append(lastrow)
            }
        }
        let submitButtonRow = document.createElement("div")
        submitButtonRow.setAttribute("class", "form-submit-button-row-class")
        let submitButton = document.createElement("button")
        submitButton.classList.add("submit_button")
        submitButton.id = this.tableId+'form'+this.forms.length
        if('buttonText' in formParameters){
            submitButton.innerHTML = formParameters.buttonText
        }else{
            submitButton.innerHTML = "Submit"
        }
        submitButtonRow.append(submitButton)
        selectedDiv.append(submitButtonRow)
        submitButton.addEventListener("click", () => {
            console.log("Submit button clicked for ", this.tableId)
            this.submitForm()
        })
    }

    async buildForeignKeyInput(formElement){
        let formElementDiv = await buildDivAndLabel(formElement);
        let selectElement = document.createElement("select");
        selectElement.id = formElement['data-qb'];
        selectElement.classList.add(formElement.class);
        selectElement.setAttribute("data-qb", formElement['data-qb']);
        if("parentName" in formElement){
            // getParentData(formElement, formElement["parent-name"])
        }
        // formElementDiv.append(selectElement);
        //
        // for (let option of formElement.choices) {
        //     let optionElement = document.createElement("option");
        //     optionElement.setAttribute("value", option);
        //     optionElement.innerHTML = option;
        //     selectElement.append(optionElement);
        // }
        return formElementDiv;
    }

    async submitForm(formObject){
        console.log("buttonID:", this.tableId+"form"+this.forms.length)

        // if (await anyHelperText()){
        //     await addTextOutsideSubmitButton(this.tableId+"form"+this.forms.length, "There is still a problem with your input. Please check the highlighted fields.")
        //     console.log("There is helper text on the page")
        //     return
        // }
        let validation = await this.qb_validate(formObject)

        if(validation){
            await this.create_record()
            await addTextOutsideSubmitButton(this.tableId+"form"+this.forms.length, "Input looks good! Uploading record...")
            console.log("Validation: ", validation)
            console.log("this rid: ", this.rid)
            console.log("this record: ", this.record)
            console.log("last record: ", this.lastRecord)
            if(this.lastRecord === this.record){
                await addTextOutsideSubmitButton(this.tableId+"form"+this.forms.length, "You haven't made any changes to the record.")
                return
            }
            let response = await this.postNewRecord()
            console.log("post response: ", response)
            if('metadata' in response){
                if('createdRecordIds' in response.metadata){
                    if(response.metadata.createdRecordIds.length > 0){
                        if(this.rid === null) {
                            await addTextOutsideSubmitButton(this.tableId + "form" + this.forms.length, "Record successfully created!")
                            document.getElementById(this.tableId + "form" + this.forms.length).innerHTML = "Edit"
                            this.rid = await this.record[this.RID_FID]['value']
                            this.lastRecord = await this.record
                        }
                    }else{
                        if('metadata' in response){
                            if('updatedRecordIds' in response.metadata){
                                if(response.metadata.updatedRecordIds.length > 0){
                                    await addTextOutsideSubmitButton(this.tableId + "form" + this.forms.length, "Record successfully edited!")
                                    this.lastRecord = await this.record
                                }else{
                                    await addTextOutsideSubmitButton(this.tableId + "form" + this.forms.length, "The record was unchanged, did you change any of the values?    ")
                                }
                            }
                        }else{
                            await addTextOutsideSubmitButton(this.tableId+"form"+this.forms.length, "There was a problem creating the record. Please try again.")}
                    }
                }
            }
        }else{
            await addTextOutsideSubmitButton(this.tableId+"form"+this.forms.length, (returnErrorMessage(this.submitErrors)))
            this.submitErrors += 1
        }
    }

    async getFormInstructions(formParameters = {}) {
        // create a list to hold the form elements
        let formElements = []
        let qb_dictionary = await this.qb_dict;
        qb_dictionary = qb_dictionary[this.tableId]
        console.log("qb_dictionary in getFormInstructions: ", qb_dictionary)

        // if formParameters is empty, use default parameters
        if (Object.keys(formParameters).length === 0) {
            console.log("No form parameters provided. Using default parameters.")
            for(let field in qb_dictionary){
                let formElement = qb_dictionary[field]
                formElement.id = field
                formElements.push(formElement)
            }
        } else if (formParameters.hasOwnProperty('fields')) {
            console.log("Fields list from form parameters provided. Using provided parameters.")
            //loop through the fields in formParameters
            for (let field of formParameters.fields) {
                // check if field is in the fieldList
                console.log("field in getforminstructions: ", field)
                if (this.fieldList.includes(field)) {
                    // if it is, add it to the formElements list
                    let formElement = qb_dictionary[field]
                    console.log("formElement: ", formElement)
                    formElement['id'] = field
                    formElements.push(formElement)
                    if (formParameters.hasOwnProperty('customFields')) {
                        // check if the field is in the customFields list
                        if (field in formParameters.customFields) {
                            console.log(`FID ${field} is in customFields`)
                            // if it is, loop through the key value pairs in the customFields object and add them to the formElement
                            for (let [key, value] of Object.entries(formParameters.customFields[field])) {
                                formElement[key] = value
                            }
                        }
                    }
                } else {
                    if (String(field).startsWith("block")) {
                        console.log(`FID ${field} is a block`)
                        if (field in formParameters.customFields) {
                            let formElement = formParameters.customFields[field]
                            formElement.id = field
                            formElement.fieldType = "block"
                            formElements.push(formParameters.customFields[field])
                        } else {
                            throw new Error(`FID ${field} is a block but no customFields with key ${field} were provided.`)
                        }

                    } else {
                        throw new Error(`Field with id ${field} not found in list of fields from this record ${this.tableId}. If you want to include this field in the form, add it to the list of fields when declaring the record object.`)
                    }
                    // if it isn't, throw an error
                }
            }
        }
        // loop through the formElements list and create the form
        for (let formElement of formElements) {
            if (!String(formElement.id).startsWith("block")) {
                if (!formElement.hasOwnProperty('type')) {
                    formElement.type = getClass(formElement.fieldType).type
                }
            } else {
                if (!formElement.hasOwnProperty('type')) {
                    formElement.type = "block"
                }
            }
            if (!formElement.hasOwnProperty('divClass')) {
                formElement.divClass = "div-" + getClass(formElement.fieldType).class
            }
            if (!formElement.hasOwnProperty('class')) {
                formElement.class = getClass(formElement.fieldType).class
            }
            if (!formElement.hasOwnProperty('data-qb')) {
                formElement['data-qb'] = this.tableId + "." + formElement.id
            }
            if (!formElement.hasOwnProperty('div_id')) {
                formElement.div_id = formElement['data-qb'] + "_div"
            }
            if (!formElement.hasOwnProperty('placeholder')) {
                formElement.placeholder = `Please enter ${formElement.label}`
            }
        }
        return formElements
    }
}

class recordList {
    constructor(validatorObject, tableId, select, where, additionalParameters = {}) {
        this.validatorObject = validatorObject
        this.tableId = tableId
        this.recordIDs = []
        this.fieldList = select
        this.qb_dict = this.getQbValidationData();
        this.records = []
        // if fields is a list, then set this.fieldList to fields
        if (Array.isArray(where)) {
            console.log("WHERE IS A LIST!!!!!!!!!!!")
            this.recordIDs = where
        }else if (typeof where === 'string') {
            this.records = this.getRecords(where, additionalParameters)
        }
        this.fieldList = select
        this.qb_dict = this.getQbValidationData();
        console.log("RecordList object created.")
        console.log("Record List qb_dict: ", this.qb_dict)
    }

    async getRecords(where, additionalParameters = {}){
        let records = await this.queryRecords(where, additionalParameters)
        return records
    }

    async buildTable(fields, tableParameters = {}) {

    }

    //METHODS
    async getQbValidationData() {
        // get the validation data from the server
        let validationObjects = await this.getValidationDictFromRecord()
        let validationData = await fetch(this.validatorObject.endpoint_url, {
            method: 'POST',
            mode: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.validatorObject.csrf_token
            },
            body: JSON.stringify({
                'data': validationObjects,
                'manner': 'getQbValidationData'
            })
        })
        let validationDataToReturn = await validationData.json()
        this.RID_FID = validationDataToReturn['primaryKey']
        return validationDataToReturn
    }


    async queryRecords(where, additionalParams={}) {

        console.log("additionalParams: ", additionalParams)
        console.log("where: ", where)

        let queryData = {
            'from': this.tableId,
            'select': this.fieldList,
            'where': where
        }

        // if there are any keys in additionalParams, add the key value pairs to data
        if(Object.keys(additionalParams).length > 0){
            for(let [key, value] of Object.entries(additionalParams)){
                queryData[key] = value
            }
        }

        console.log("queryData: ", queryData)

        let response = await fetch(this.validatorObject.endpoint_url, {
            method: 'POST',
            mode: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.validatorObject.csrf_token
            },
            body: JSON.stringify({
                'data': queryData,
                'manner': 'queryRecords'
            })
        })
        let jsonresult = await response.json()
        if('data' in jsonresult){
            return jsonresult['data']
        }else{
            console.log("NO RECORDS FOUND")
            return []
        }
    }

    async getValidationDictFromRecord() {
        // create a dictionary to hold the validation data
        let validationDict = {}
        for (let field of this.fieldList) {
            let table_id = this.tableId
            let field_id = field
            // check if table_id is already a key in validationObjects
            if (table_id in validationDict) {
                // if it is, add field_id to the array
                validationDict[table_id].push(field_id)
            } else {
                // if it isn't, create a new key with the table_id and add the field_id to the array
                validationDict[table_id] = [field_id]
            }
        }
        return validationDict;
    }
}

class endpoint {
    constructor(endpoint_url, csrf_token) {
        this.endpoint_url = endpoint_url
        this.csrf_token = csrf_token
        this.qb_dict = {}
    }//end constructor
}

// function to check if a value is text
function isText(value){
    return typeof value === "string";
}

// function to check if a value is one of the choices
function isMultipleChoice(value, choices){
    return choices.includes(value);
}

// function to verify valid email address
function isEmail(value){
    console.log("validating email...");
    return value.match(/^([\w-\.]+@([\w-]+\.)+[\w-]{2,4})?$/);
}

// function to check if a value is a number
function isNumber(value){
    return !isNaN(value);
}

//function to check if a value is an integer
function isInteger(value){
    return Number.isInteger(value);
}

// function to check if a value is a date
function isDate(value){
    return !isNaN(Date.parse(value));
}

// function to check if a value is a boolean
function isBoolean(value){
    return typeof value === "boolean";
}

// function to check if a value is a valid phone number
function isPhone(value){
    console.log("validating phone number");
    // use regex to validate that value is a phone number with optional extension
    return value.match(/(\+\d{1,3}\s?)?((\(\d{3}\)\s?)|(\d{3})(\s|-?))(\d{3}(\s|-?))(\d{4})(\s?(([E|e]xt[:|.|]?)|x|X)(\s?\d+))?/);
}

async function addHelperText(element_id, helper_text) {
    let error_color = await getErrorColor();
    console.log("In addHelperText, error_color: ", error_color);
    let element = document.getElementById(element_id)

    if(['number'].includes(element.getAttribute('type')) || ['SELECT'].includes(element.nodeName)){
        console.log("element type is: " + element.getAttribute('type'))
        addHelperTextOutsideInput(element_id, helper_text)
    }else{
        element.value = helper_text
        element.setAttribute('data-helpertext', "true")
        element.style.color = error_color
        element.style.borderColor = error_color;
        // element.style.outline = error_color
        // element.style.outlineStyle = "solid"
        element.addEventListener("input", () => {
            removeHelperText(element)
        })
        element.addEventListener("click", () => {
            element.value = ""
            removeHelperText(element)
        })

    }
}

async function addHelperTextOutsideInput(element_id, helper_text) {

    //create a div and append it to body
    let div = document.createElement('div')

    // add the div to the body
    document.body.appendChild(div)


    let error_color = await getErrorColor()

    let element = document.getElementById(element_id)

    element.style.outline = error_color
    element.style.outlineStyle = "solid"
    element.style.color = error_color
    element.value = helper_text

    element.setAttribute('data-helpertext', "true")
    if(document.getElementById(`${element_id}-error_message`)) {
        document.getElementById(`${element_id}-error_message`).remove()
    }
    let span = document.createElement("div")
    span.style.color = error_color
    span.id = `${element_id}-error_message`
    span.append(`${helper_text}`)
    element.before(span)
    element.addEventListener("input", () => {
        remove_warning(span)
    })

    // element.addEventListener("input", () => {
    //     removeHelperText(element)
    // })

    element.addEventListener("click", () => {
        element.value = ""
        removeHelperText(element)
    })
}

async function getErrorColor() {
    console.log("GET ERROR COLOR")
    // select element of class 'error-message'
    let thethingitself = await document.createElement('div');
    // set class of template to 'error-message'
    await thethingitself.setAttribute('class', 'errorMessage');
    await document.body.appendChild(thethingitself)
    console.log("thing: ", thethingitself)
    let styles = await getComputedStyle(thethingitself)
    let errorColor = styles.getPropertyValue('color')
    // remove thethingitself from the DOM
    await thethingitself.remove()
    console.log("styles: ", styles)
    console.log("errorColor: ", errorColor)
    return errorColor
}

async function addTextOutsideSubmitButton(elementID, message) {

    //see if element already exists
    if(document.getElementById(`${elementID}-error_message`)) {
        document.getElementById(`${elementID}-error_message`).remove()
    }
    let error_color = await getErrorColor()
    console.log("error_color in add text function: ", error_color)
    let element = document.getElementById(elementID)
    let span = document.createElement("div")
    span.style.color = error_color
    span.id = `${element.id}-error_message`
    // change span class to div-error-submit-message
    span.setAttribute('class', 'div-error-submit-message')
    span.append(message)
    // get parent element of element
    let parent = element.parentElement
    parent.append(span)
    element.after(span)
    element.addEventListener("click", () => {
        remove_warning(span)
    })
}

async function removeHelperText(element) {
    console.log("REmove Helper Text Element: ", element)
    console.log("removing helper text")
    // return element styling to normal
    let template_element = document.createElement("div")
    //set class of template element to the class of the element
    template_element.className = element.className
    let style = await getComputedStyle(template_element)
    console.log("style: ", style)
    element.style = style
    // element.style.color = style.color
    // element.style.outline = style.outline
    // element.style.borderColor = style.borderColor
    // if element has a data-helpertext attribute, remove it
    if(element.getAttribute('data-helpertext')){
        element.removeAttribute('data-helpertext')
    }
    let old_element = element
    let new_element = await old_element.cloneNode(true);
    old_element.parentNode.replaceChild(new_element, old_element);

    new_element.focus()
    if(new_element.type === "tel") {
        new_element.addEventListener('keyup', formatToPhone);
    }

    // if new_element is of class 'currency-input-class', add event listener to format to currency
    if(new_element.classList.contains('currency-input-class')) {
        new_element.addEventListener('input', formatToCurrency);
    }
}

async function anyHelperText() {
    // find all elements with data-helpertext attribute
    let elements = document.querySelectorAll('[data-helpertext]')
    let numberOfHelperTextElements = elements.length
    console.log("number of helper text elements found: " + numberOfHelperTextElements)
    if(numberOfHelperTextElements > 0){
        return true
    }else{
        return false
    }
}

function remove_warning(element){
    element.remove()
}

function getClass(type) {
    let classType = {}
    switch (type) {
        case "text":
            classType.class = "text-input-class"
            classType.type = "text"
            break
        case "numeric":
            classType.class = "number-input-class"
            classType.type = "number"
            break
        case "currency":
            classType.class = "currency-input-class"
            classType.type = "number"
            break
        case "percent":
            classType.class = "percent-input-class"
            classType.type = "number"
            break
        case "date":
            classType.class = "date-input-class"
            classType.type = "date"
            break
        case "timestamp":
            classType.class = "timestamp-input-class"
            classType.type = "datetime-local"
            break
        case "checkbox":
            classType.class = "checkbox-input-class"
            classType.type = "checkbox"
            break
        case "phone":
            classType.class = "phone-input-class"
            classType.type = "tel"
            break
        case "email":
            classType.class = "email-input-class"
            classType.type = "email"
            break
        case "rich-text":
            classType.class = "textarea-input-class"
            classType.type = "textarea"
            break
        case "text-multi-line":
            classType.class = "textarea-input-class"
            classType.type = "textarea"
            break
        case "text-multiple-choice":
            classType.class = "select-input-class"
            classType.type = "select"
            break
        case "block":
            classType.class = "block-class"
            classType.type = "block"
            break
        case "timeofday":
            classType.class = "time-input-class"
            classType.type = "time"
            break

        case "rating":
            classType.class = "rating-input-class"
            classType.type = "rating"
            break
    }
    return classType
}

async function buildBlock(formElement){
    let formElementDiv = document.createElement("div");
    formElementDiv.id = formElement.div_id;
    formElementDiv.classList.add(formElement.divClass);
    formElementDiv.innerHTML = formElement.content;
    return formElementDiv;
}


async function buildDivAndLabel(formElement){
    let formElementDiv = document.createElement("div");
    formElementDiv.id = formElement.div_id;
    formElementDiv.setAttribute("class", formElement.divClass);
    let label = document.createElement("label");
    label.setAttribute("for", formElement['data-qb']);
    label.classList.add("form-label");
    label.innerHTML = formElement.label;
    formElementDiv.append(label);
    return formElementDiv;
}

async function buildInput(formElement){
    let type = "text"
    switch(formElement.type){
        case "text":
            break

    }

}

async function buildInput(formElement){
    let formElementDiv = await buildDivAndLabel(formElement);
    let inputElement = document.createElement("input");
    inputElement.id = formElement['data-qb'];
    inputElement.placeholder = formElement.placeholder;
    inputElement.classList.add(formElement.class);

    if(formElement.type === "tel"){
        if(!(('formatPhone' in formElement) && !formElement.formatPhone)){
            inputElement.addEventListener('keyup',formatToPhone);
            inputElement.setAttribute("data-value", `formatPhoneInput('${inputElement.id}')`)
        }
    }
    if(formElement.class === "currency-input-class"){
        inputElement.addEventListener('blur',formatToCurrency);
    }
    if(formElement.type === "checkbox"){
        inputElement.setAttribute("data-value", `document.getElementById('${formElement['data-qb']}').checked`);
        inputElement.checked = formElement.checked
    }
    if(formElement.type === "datetime-local"){
        inputElement.setAttribute("data-value", `convertDatetime(document.getElementById('${formElement['data-qb']}').value)`);
    }
    if(["currency-input-class", "percent-input-class"].includes(formElement.class)){
        let currencySpan = document.createElement("div");
        currencySpan.classList.add("currency-span");
        currencySpan.append(inputElement)
        formElementDiv.append(currencySpan);
        console.log("currency input class")
        let currencySymbol = document.createElement("span");
        currencySymbol.classList.add("currency-code");
        if(formElement.class === "currency-input-class"){
            currencySymbol.innerHTML = "$";
        }else if(formElement.class === "percent-input-class"){
            currencySymbol.innerHTML = "%";
            inputElement.setAttribute("data-value", `getValuePercentInput('${formElement['data-qb']}')`)
        }
        currencySpan.insertBefore(currencySymbol, inputElement);
    }else{
        formElementDiv.append(inputElement);
    }
    inputElement.setAttribute("type", formElement.type);
    inputElement.setAttribute("data-qb", formElement['data-qb']);
    if("data-value" in formElement){
        inputElement.setAttribute("data-value", formElement['data-value']);
    }
    // formElementDiv.append(label);

    return formElementDiv;
}

async function buildTextAreaInput(formElement) {
    let formElementDiv = await buildDivAndLabel(formElement);
    let inputElement = document.createElement("textarea");
    inputElement.id = formElement['data-qb'];
    inputElement.placeholder = formElement.placeholder;
    inputElement.classList.add(formElement.class);
    inputElement.setAttribute("data-qb", formElement['data-qb']);
    if("data-value" in formElement){
        inputElement.setAttribute("data-value", formElement['data-value']);
    }
    formElementDiv.append(inputElement);
    return formElementDiv;
}

async function buildSelectInput(formElement){
    let formElementDiv = await buildDivAndLabel(formElement);
    let selectElement = document.createElement("select");
    selectElement.id = formElement['data-qb'];
    selectElement.classList.add(formElement.class);
    selectElement.setAttribute("data-qb", formElement['data-qb']);
    if("data-value" in formElement){
        selectElement.setAttribute("data-value", formElement['data-value']);
    }
    formElementDiv.append(selectElement);

    let optionElement = document.createElement("option");
    optionElement.setAttribute("value", '');
    optionElement.innerHTML = `Please Select ${formElement.label}`;
    selectElement.append(optionElement);

    for (let option of formElement.choices) {
        let optionElement = document.createElement("option");
        optionElement.setAttribute("value", option);
        optionElement.innerHTML = option;
        selectElement.append(optionElement);
    }
    return formElementDiv;
}

async function buildRatingInput(formElement){
    let formElementDiv = await buildDivAndLabel(formElement);
    let inputElement = document.createElement("div");
    inputElement.id = formElement['data-qb']+"-wrapper";
    inputElement.placeholder = formElement.placeholder;
    inputElement.classList.add(formElement.class);

    let span = document.createElement("span");
    // change span class to 'star-cb-group'
    span.classList.add("star-cb-group");

    // let input = document.createElement("input");
    // input.setAttribute("type", "radio");
    // input.setAttribute("name", 'rating');
    // input.setAttribute("id", formElement['data-qb']);
    // input.setAttribute("value", 5);


    let html =`
                <span class="star-cb-group">
                  <input type="radio" id="${formElement['data-qb']}" data-value="getStarRating('${formElement['data-qb']}')" data-qb="${formElement['data-qb']}"  checked="checked" name="rating" value="5" />
                  <label for="${formElement['data-qb']}">5</label>
                  <input type="radio" id="${formElement['data-qb']}-rating-4" name="rating" value="4" />
                  <label for="${formElement['data-qb']}-rating-4">4</label>
                  <input type="radio" id="${formElement['data-qb']}-rating-3" name="rating" value="3" />
                  <label for="${formElement['data-qb']}-rating-3">3</label>
                  <input type="radio" id="${formElement['data-qb']}-rating-2" name="rating" value="2" />
                  <label for="${formElement['data-qb']}-rating-2">2</label>
                  <input type="radio" id="${formElement['data-qb']}-rating-1" name="rating" value="1" />
                  <label for="${formElement['data-qb']}-rating-1">1</label>
                  <input type="radio" id="${formElement['data-qb']}-rating-0" name="rating" value="0" class="star-cb-clear" />
                  <label for="${formElement['data-qb']}-rating-0">0</label>
                </span>
`

    if("data-value" in formElement){
        ratingElement.setAttribute("data-value", formElement['data-value']);
    }
    inputElement.innerHTML = html;
    formElementDiv.append(inputElement);

    // document.getElementById(formElement.id).setAttribute("data-value", `getStarRatingValue('${formElement['data-qb']}')`);

    return formElementDiv;
}

function getStarRating(id){
    let returnRating = 5
    let starOne = document.getElementById(id);
    console.log("first star: ", starOne.checked);
    if(starOne.checked){
        return starOne.value;
    }
    for (let i = 0; i < 5; i++) {
        let star = document.getElementById(id+"-rating-"+i);
        // print value of star
        console.log("star ", i, ": ", star.checked);
        if(star.checked){
            return star.value
        }
    }
    return 5
}

async function buildParentRecordInput(formElement, parentData) {
    console.log("building foreign key input...")
    console.log("parentData is: " + JSON.stringify(parentData))
    let formElementDiv = await buildDivAndLabel(formElement);
    let inputElement = document.createElement("input");
    inputElement.setAttribute('data-qb', formElement['data-qb']);
    inputElement.classList.add("searchable-dropdown-input-class");
    inputElement.setAttribute("list", formElement['data-qb'] + "-list");
    inputElement.setAttribute("data-value", `getRidFromDatalist('${formElement['data-qb']}')`);
    inputElement.id = formElement['data-qb'];
    if ('placeholder' in formElement) {
        inputElement.placeholder = formElement.placeholder;
    }else{
        inputElement.placeholder = `Search for ${formElement.label} or select from list:`;
    }
    let dataList = document.createElement("datalist");
    dataList.id = formElement['data-qb'] + "-list";
    for(let i = 0; i < parentData['data'].length; i++){
        let option = document.createElement("option");
        if('name-fid' in formElement){
            option.value = parentData['data'][i][formElement['name-fid']]['value'];
        }else{
            option.value = parentData['data'][i]['6']['value'];
        }
        option.dataset.value = parentData['data'][i][formElement['parentTableKeyFid']]['value'];
        dataList.appendChild(option);
    }
    formElementDiv.append(inputElement);
    formElementDiv.append(dataList)
    return formElementDiv;
}

function getRidFromDatalist(inputElementName){
    let ele = document.getElementById(inputElementName);
    var dl=ele.list.options;
    for (var x=0;x<dl.length;x++){
        if (dl[x].value===ele.value){
            console.log("found match: " + ele.value)
            return dl[x].dataset.value;
        }
    }
    return ''
}

const isModifierKey = (event) => {
    const key = event.keyCode;
    return (event.shiftKey === true || key === 35 || key === 36) || // Allow Shift, Home, End
        (key === 8 || key === 9 || key === 13 || key === 46) || // Allow Backspace, Tab, Enter, Delete
        (key > 36 && key < 41) || // Allow left, up, right, down
        (
            // Allow Ctrl/Command + A,C,V,X,Z
            (event.ctrlKey === true || event.metaKey === true) &&
            (key === 65 || key === 67 || key === 86 || key === 88 || key === 90)
        )
};
const formatToPhone = (event) => {
    console.log("formatting to phone...")
    if(isModifierKey(event)) {return;}

    const input = event.target.value.replace(/\D/g,'').substring(0,10); // First ten digits of input only
    const areaCode = input.substring(0,3);
    const middle = input.substring(3,6);
    const last = input.substring(6,10);

    if(input.length > 6){event.target.value = `(${areaCode}) ${middle} - ${last}`;}
    else if(input.length > 3){event.target.value = `(${areaCode}) ${middle}`;}
    else if(input.length > 0){event.target.value = `(${areaCode}`;}
};

function formatPhoneInput(inputElementID){
    // remove all non-numeric characters
    let inputElement = document.getElementById(inputElementID);

    // remove dashes, spaces and parentheses from input
    return inputElement.value.replace(/[- )(]/g, '');
}

const formatToCurrency = (event) => {
    if(isModifierKey(event)) {return;}
    const value = event.target.value.replace(/,/g, '');
    event.target.value = parseFloat(value).toLocaleString('en-US', {
        style: 'decimal',
        maximumFractionDigits: 2,
        minimumFractionDigits: 2
    }).replace(/,/g,'');
};

function getValuePercentInput(inputElementId){
    let inputElement = document.getElementById(inputElementId);
    let value = inputElement.value;
    if (value === "") {
        return ""
    }else{
        return value / 100;
    }
}

function returnErrorMessage(numberOfErrors){
    if(numberOfErrors === 0){
        return "There is a problem with your submission. Please change the highlighted fields and try again."
    }
    if(numberOfErrors === 1){
        return "There is still a problem with your submission. Have you checked the highlighted fields?"
    }
    let sentences = ["Maybe if you try again you'll get a better result?", "Haha, you thought that would work?", "That's NOT the right answer.. *heavy sigh*", "Do I look like a fortuneteller to you?", "Wow, your attempt was really something else...", "Are you kidding me right now?", "Didn't your mother ever teach you to think before doing?", "Hey, I love your enthusiasm but this isn't working.", "Nope, sorry, wrong input!", "Let's face it, you are no mathematician...", "Come on now, try again!", "I think you missed the boat on this one.", "That's an automatic fail, my friend!", "Input invalid! Please try again!", "Sigh... Please don't do that again?", "How about we find your correct input this time?", "Oooh... that one didn't quite work out.", "Well, that wasn't what I was expecting...", "WRONG!!! Do you want to try again?", "I'm pretty sure that was totally wrong!", "Uhhh... no! Try again, please!", "Do I really have to explain why that won't work?", "That was an epic fail, to be honest.", "I don't think that'll pass the test.", "Try again or I'm sending you back to the start.", "Just face it - you failed.", "What was that supposed to be?", "Nope, sorry. You gotta do better.", "Um... I think you mistyped something.", "I think that one didn't quite work out.", "You ain't gonna get no prizes for that attempt!", "That's a no-brainer - wrong!", "Seriously, what were you thinking?!", "That's not even close to being right!", "Oh, so very wrong...", "Mmm, not quite!", "Boy, you sure messed up on that one, didn't you?", "Oops! Wrong input! Try again!", "Umm, yeah, think again, pal!", "Really? That didn't work?", "You missed the mark on this one, buddy.", "Aaaand that one was a dud!", "Haha! No, that won't work!", "I think you know the answer - wrong!", "That was wrong, just wrong!", "No! That input won't do!", "NU-UH. Invalid input!", "Come on... you can do better than that!", "Nope, try again! That didn't work!", "Boy, you need to get your game together.", "Seriously!? Even I know that won't work!", "Oh no! That was not the correct answer!", "Well, that didn't end too well, did it?", "Ah, wrong! Not even close!", "That was a valiant attempt, but no!", "Forget about that - it's wrong!", "Haha, you thought THAT would work?", "Wrong, wrong, wrong!", "Hm, no. That won't work.", "Are you sure you meant to enter that?", "That one's out of the question - wrong!", "Nope, not gonna fly! Try again.", "No, no, no. That won't work!", "Really? You know that's not right!", "That'll be a 'no' from me.", "That won't work, my friend.", "Oh puh-lease - that one is wrong!", "What you have entered is incorrect.", "Can you try harder than that please?", "Yes, that was wrong. I'm sorry.", "Sorry mate, that won't do.", "May I suggest another option?", "MAN, that was wrong!", "Incorrect input! Please try again.", "That one didn't even get close!", "That isn't even in the ballpark!", "Haha... wow, why did you even bother?", "That's incorrect. Big surprise, right?", "Ugh, that was the wrong input.", "Let's not go down that path again, shall we?", "Try it again, this time with feeling!", "No, that won't get you anywhere.", "Woah woah woah, wrong input!", "I'm afraid that didn't work.", "Nuh-uh! We have to try again.", "No, that input won't get us where we need to go.", "Input invalid! Input again!", "Like, really? That won't work.", "That won't work - Are you paying attention?", "Nooo, not even close! Let's try again.", "Yikes, that wasn't quite it.", "Exuse me? That input won't do!", "Oh gosh, wrong again?", "Uh oh, wrong input! Try again.", "Oy vey! That's not the answer!", "Um, that's wrong. Let's try something else.", "That one was wrong but better luck this time!", "Come on! You can do better than that!", "Yeah, no. That won't work.", "Let's make sure the next one is correct, OK?", "Improper input! Start again, please.", "Ugh, wrong again. Sigh...."]
    let randomIndex = Math.floor(Math.random() * sentences.length);
    return sentences[randomIndex] + " Please, try again.";
}

function convertDatetime(datetime) {
    if( datetime === '' ){
        return ''
    }
    //Split input datetime string by "T" delimiter
    let elements = datetime.split("T");
    //Set packed yr-mo-day from array elements[0]
    let ymd = elements[0];
    //Set packed hr-min from array elements[1]
    let hm = elements[1];

    //Return ymd and hm merged with a semicolon delimiter
    return ymd + "T" + hm + ":00";
}

class client {
    constructor(userToken, realm, numberOfAttempts=0, timeout=0) {
        this.headers = {
            "QB-Realm-Hostname": realm,
            'Content-Type': 'application/json',
            'Authorization': 'QB-USER-TOKEN ' + userToken
        };

        this.numberOfAttempts = numberOfAttempts
        this.timeout = timeout

    }//end constructor

    //METHODS:


    //QUERY:
    //search a table using Quickbase query argument

    //PARAMETERS:
    //table: the table id (string)
    //query: the Quickbase query, example: "3.GT.0" (all records where field #3 is greater than 0)
    //select array: an array of the fields you want returned (array of integers)

    //RETURNS:
    // an array of the found records
    async query(table, query, selectArray, additionalParams = null) {

        const body = {
            "from": table,
            "select": selectArray,
            "where": `${query}`
        };

        if (additionalParams !== null) {
            //add additional parameters to the body
            for (const [key, value] of Object.entries(additionalParams)) {
                body[key] = value
            }
        }

        let response = {};
        response.status = 429
        let attemptCounter = 0

        while(response.status === 429 && attemptCounter<=this.numberOfAttempts) {

            response = await fetch('https://api.quickbase.com/v1/records/query', {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(body)
            })
            if (response.status === 429) {
                console.log("Too Many Request, Trying Again")
                await new Promise(resolve => setTimeout(resolve, this.timeout))
                attemptCounter++
            }
        }

        if(response.status===200) {
            let data = await response.json()
            return await data['data']
        }else{
            console.log("Error querying records. Quickbase error code: " + response.status + ". Error message: \""+response.statusText +"\"")
            console.log("response: ", response.json())
            return response
        }
    }

    async getQbValidationData(){

    }


    //MULTIQUERY
    //get multiple records at once, with values matching an array of values

    //PARAMETERS:
    //Table: the table id (string)
    //search field: the field id of the field you are querying (integer)
    //queryArray: an array of values you are looking for (array of strings or numbers)
    //selectArray: an array of the fields you want returned (array of integers)

    //RETURNS:
    // an array of the found records

    async multiquery(table, searchfield, queryArray, selectArray) {

        let array = []
        let arrayArray = []
        let datareturn = []

        //Divide the queryArray into an array of arrays with length 100
        //(Quickbase only allows 100 queries per API call)
        for(let i = 0; i<queryArray.length; i++){

            array.push(queryArray[i])
            if(i!==0&&(i+1)%100 === 0){
                arrayArray.push(array)
                array = []
            }
            else if (i === queryArray.length-1){
                arrayArray.push(array)
            }
        }
        //Loop through the array of query arrays and query Quickbase 100 queries at a time
        //add found records to arrayArray
        for (let i in arrayArray){
            let queryString = queryStringBuilder(searchfield, "EX", "OR", arrayArray[i])

            const body = {
                "from": table,
                "select": selectArray,
                "where": `${queryString}`
            };

            let response = {};
            response.status = 429
            let attemptCounter = 0

            while(response.status === 429 && attemptCounter<=this.numberOfAttempts) {

                response = await fetch('https://api.quickbase.com/v1/records/query', {
                    method: 'POST',
                    headers: this.headers,
                    body: JSON.stringify(body)
                })
                if (response.status === 429) {
                    console.log("Too Many Request, Trying Again")
                    await new Promise(resolve => setTimeout(resolve, this.timeout))
                    attemptCounter++
                }
            }

            if(response.status === 200){
                let data = await response.json()
                datareturn.push(data['data'])
            }else{
                console.log("Error querying records. Quickbase error code: " + response.status + ". Error message: \""+response.statusText +"\"")
                console.log("response: ", response.json())
                return response
            }
        }
        return datareturn;
    }

    //POST
    //creates or updates records depending on whether key field (usually field ID #3) is present
    //if key id is given and exists in the table, that record will be updated
    //if key id is not given, a record will be created
    //if key id is given but does not exist in the table, a record will be created with the given key id

    //PARAMETERS
    //table_id: the table id (string)
    //record_array: an array of record objects (each containing field objects)

    //RETURNS
    //a dictionary of arrays of the RID's that have been created, unchanged and edited


    async post(table_id, record_array) {
        const data = {
            to: table_id,
            data: record_array
        };

        let response = {};
        response.status = 429
        let attemptCounter = 0

        while (response.status === 429 && attemptCounter <= this.numberOfAttempts) {

            response = await fetch('https://api.quickbase.com/v1/records', {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(data)
            })
            if (response.status === 429) {
                console.log("Too Many Request, Trying Again")
                await new Promise(resolve => setTimeout(resolve, this.timeout))
                attemptCounter++
            }
        }

        if (response.status === 200) {
            let data = await response.json()

            return {
                createdRecordIds: data.metadata.createdRecordIds,
                unchangedRecordIds: data.metadata.unchangedRecordIds,
                updatedRecordIds: data.metadata.updatedRecordIds
            }

        } else {
            let data = await response.json()
            console.log("Error creating records. Quickbase error code: " + response.status + ". Error message: \"" + response.statusText + "\"")
            console.log("response: ", data)
            if ('metadata' in data) {
                if ('lineErrors' in data['metadata']) {
                    let dict = data['metadata']['lineErrors']
                    for ( const [key] of Object.entries(dict)) {
                        console.log("Line errors from posting Record #", key, ":")
                        for (let i = 0; i < data['metadata']['lineErrors'][key].length; i++) {
                            console.log(data['metadata']['lineErrors'][key][i])
                        }

                    }
                    return data
                }
            }
            return response
        }
    }



    //DELETE:
    //Delete ALL records that satisfy Quickbase query

    //PARAMETERS:
    //table: the table id (string)
    //query: the Quickbase query, example: "3.EX.499" (all records where field #3 equals 499)

    //RETURNS:
    // The number of records deleted

    async delete(table_id, query){
        const body = {
            "from": table_id,
            "where": `${query}`
        };

        let response = {};
        response.status = 429
        let attemptCounter = 0
        while(response["status"] === 429 && attemptCounter<=this.numberOfAttempts) {

            response = await fetch('https://api.quickbase.com/v1/records', {
                method: 'DELETE',
                headers: this.headers,
                body: JSON.stringify(body)
            })

            if (response.status === 429) {
                console.log("Too Many Request, Trying Again")
                await new Promise(resolve => setTimeout(resolve, this.timeout))
                attemptCounter++
            }
        }

        if(response.status===200){
            let data = await response.json()
            return await data['numberDeleted']
        }else{
            console.log("Error deleting records. Quickbase error code: " + response.status + ". Error message: \""+response.statusText +"\"")
            console.log("response: ", response.json())
            return response
        }
    }

    //MULTIDELETE
    //delete multiple records at once with an array of values as input

    //PARAMETERS:
    //Table: the table id (string)
    //search field: the field id of the field you are querying (integer)
    //deleteArray: an array of values you are looking for (array of strings or numbers)

    //RETURNS:
    // the number of deleted records

    async multidelete(table_id, searchfield, deleteArray) {

        let array = []
        let arrayArray = []
        let number_deleted = 0

        //Divide the deleteArray into an array of arrays with length 100
        //(Quickbase only allows 100 queries per API call)
        for(let i = 0; i<deleteArray.length; i++){

            array.push(deleteArray[i])
            if(i!==0&&(i+1)%100 === 0){
                arrayArray.push(array)
                array = []
            }
            else if (i === deleteArray.length-1){
                arrayArray.push(array)
            }
        }
        //Loop through the array of delete arrays and delete Quickbase records 100 at a time
        //add number of return records to number_deleted
        for (let i in arrayArray){
            let queryString = queryStringBuilder(searchfield, "EX", "OR", arrayArray[i])

            const body = {
                "from": table_id,
                "where": `${queryString}`
            };

            let response = {};
            response.status = 429
            let attemptCounter = 0

            while(response.status === 429 && attemptCounter<=this.numberOfAttempts) {

                response = await fetch('https://api.quickbase.com/v1/records', {
                    method: 'DELETE',
                    headers: this.headers,
                    body: JSON.stringify(body)
                })
                if (response.status === 429) {
                    console.log("Too Many Request, Trying Again")
                    await new Promise(resolve => setTimeout(resolve, this.timeout))
                    attemptCounter++
                }
            }

            if(response.status === 200){
                let data = await response.json()
                console.log("multidelete response: ", data)
                number_deleted+=data['numberDeleted']

            }else{
                console.log("Error querying records. Quickbase error code: " + response.status + ". Error message: \""+response.statusText +"\"")
                console.log("response: ", response.json())
                return response
            }
        }
        return number_deleted
    }

    //GETCHOICES
    //get all the options of a multiple choice field

    //PARAMETERS:

    //table_id(str)
    //FID (int)


    async getchoices(table_id, field_id){

        let response = {};
        response.status = 429
        let attemptCounter = 0
        let fetch_url = "https://api.quickbase.com/v1/fields/"+field_id.toString()+"?tableId="+table_id+"&includeFieldPerms=False"

        while(response["status"] === 429 && attemptCounter<=this.numberOfAttempts) {

            response = await fetch(fetch_url, {
                method: 'GET',
                headers: this.headers,
            })

            if (response.status === 429) {
                console.log("Too Many Request, Trying Again")
                await new Promise(resolve => setTimeout(resolve, this.timeout))
                attemptCounter++
            }
        }

        if(response.status===200){
            let data = await response.json()
            return await data['properties']['choices']
        }else{
            //give error to user
            console.log("Error querying for field choices. Quickbase error code: " + response.status + ". Error message: \""+response.statusText +"\"")
            console.log("response: ", response.json())
            return response
        }

    }


}//end class


//helper function to build query strings
function queryStringBuilder(searchfield, argument, operator, valueArray){

    let queries = []

    for(let i = 0; i < valueArray.length; i++){
        if(typeof valueArray[i] === "string" || valueArray[i] instanceof String){
            let query = "{" + searchfield + "." + argument + ".\'" + valueArray[i] + "\'}"
            queries.push(query)
        }else{
            let query = "{" + searchfield + "." + argument + "." + valueArray[i] + "}"
            queries.push(query)
        }

    }

    return queries.join(operator)
}

function dynamicallyLoadScript(url) {
    var script = document.createElement("script");  // create a script DOM node
    script.src = url;  // set its src to the provided URL

    document.head.appendChild(script);  // add it to the end of the head section of the page (could change 'head' to 'body' to add it to the end of the body section instead)
}

dynamicallyLoadScript("https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js")

async function create_pdf_b64(opt){
    const element = document.querySelector('body');
    const worker = html2pdf().set(opt).from(element);
    var pdf_object
    await worker.outputPdf('datauristring').then(function (pdfAsString) {
        pdf_object = pdfAsString
    });
    return pdf_object.split('base64,')[1]
}

//function that takes a url and returns a base64 string
async function url_to_b64(url) {
    return new Promise((resolve, reject) => {
        var xhr = new XMLHttpRequest();
        xhr.onload = function() {
            var reader = new FileReader();
            reader.onloadend = function() {
                resolve(reader.result);
            }
            reader.readAsDataURL(xhr.response);
        };
        xhr.open('GET', url);
        xhr.responseType = 'blob';
        xhr.send();
    });
}

//function that takes in a number and returns a currency format with 2 decimal places
function formatCurrency(num) {
    return "$" + num.toFixed(2).replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
}

//function to change date to mm-dd-yyyy
function formatDate(date) {
    var d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2)
        month = '0' + month;
    if (day.length < 2)
        day = '0' + day;

    return [month, day, year].join('-');
}