/**
 * Created by daiweilu on 12/3/13.
 */
describe("hello world test", function() {
  var a;
  beforeEach(inject(function($compile) {
    a = 4;
  }))

  it("should eq 4", function() {
    expect(a).toBe(4);
  })
})
