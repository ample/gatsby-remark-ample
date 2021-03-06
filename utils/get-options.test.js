const getOptions = require("./get-options")
const path = require("path")

describe("getOptions", () => {
  it("has sensible defaults", () => {
    expect(getOptions()).toEqual({
      contentSrc: "src/content/",
      imageExtensions: [".jpg", ".jpeg", ".png"],
      imageSuffix: "_src",
      imageSrc: path.join(__dirname, "../../../static"),
      markdownSuffix: "_md",
      modelField: "model",
      models: [],
      projectRoot: path.join(__dirname, "../../../"),
      seoField: "seo"
    })
  })
  it("provides a means to override defaults", () => {
    expect(getOptions({ contentSrc: "./content/" }).contentSrc).toEqual("./content/")
    expect(getOptions({ imageExtensions: [".svg"] }).imageExtensions).toEqual([".svg"])
    expect(getOptions({ imageSuffix: "__image__" }).imageSuffix).toEqual("__image__")
    expect(getOptions({ imageSrc: "./uploads" }).imageSrc).toEqual("./uploads")
    expect(getOptions({ markdownSuffix: "__m__" }).markdownSuffix).toEqual("__m__")
    expect(getOptions({ modelField: "_tmpl" }).modelField).toEqual("_tmpl")
    expect(getOptions({ models: ["Page", "Post"] }).models).toEqual(["Page", "Post"])
    expect(getOptions({ seoField: "__s__" }).seoField).toEqual("__s__")
  })
  it("adds a trailing slash to contentSrc", () => {
    expect(getOptions({ contentSrc: "./content" }).contentSrc).toEqual("./content/")
  })
})
