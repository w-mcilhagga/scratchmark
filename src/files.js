//  <input hidden type="file" id="upload" accept=".js, .py" />

function uploader(callback, accepts = '', readas = 'readAsText') {
    // accepts is e.g. ".js, .py" to accept javascript and python files
    // setting it to '' accepts all files.
    //
    // callback takes (filename, filecontents)
    //
    // readas names the file reader routine. Can also use
    // readasArrayBuffer, readasBinaryString, readasDataURL
    //
    // Returns the input element which does not need to be attached to the
    // document to work.
    //
    // use input.click() to trigger the upload
    // **within an event handler** because user intervention is required.

    let input = document.createElement('input')
    input.type = 'file'
    input.hidden = true
    input.accept = accepts

    /* "onchange" event handler
     * when a file is selected by the dialog, the onchange event is fired.
     * This loads the file using a reader and passes it to the callback
     */

    input.onchange = async (evt) => {
        // called when a file is selected

        // get the filename and create a file reader object
        let file = event.target.files[0]
        callback(file.name, await file.text())
        input.value = ''
    }

    return input
}

/* download some text to a file, with given name as prompt
 * copied from the internet, basically.
 */
function download(filename, text) {
    let blob = new Blob([text], { type: 'text/plain' })
    let elem = window.document.createElement('a')
    elem.href = window.URL.createObjectURL(blob)
    elem.download = filename
    elem.click()
}

// some utility functions
/* return the file extension
 */
function get_extension(filename) {
    return filename.slice(filename.lastIndexOf('.') + 1)
}

/* replace the file extension
 */
function replace_extension(filename, newext) {
    return filename.slice(0, filename.lastIndexOf('.')) + newext
}
